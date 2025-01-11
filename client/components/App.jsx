import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }
  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  async function startSession() {
    try {
        console.log("1. Session başlatılıyor...");
        
        // Get an ephemeral key from the Fastify server
        const tokenResponse = await fetch("/token");
        const data = await tokenResponse.json();
        const EPHEMERAL_KEY = data.client_secret.value;

        console.log("2. Token alındı");

        // Create a peer connection
        const pc = new RTCPeerConnection();
        console.log("3. RTCPeerConnection oluşturuldu");

        // Set up to play remote audio from the model
        audioElement.current = document.createElement("audio");
        audioElement.current.autoplay = true;
        pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

        // Add local audio track for microphone input in the browser
        const ms = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        pc.addTrack(ms.getTracks()[0]);
        console.log("4. Audio track eklendi");

        // Önce offer oluştur
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log("5. Local description ayarlandı");

        // API'ye bağlan
        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-realtime-preview-2024-12-17";
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${EPHEMERAL_KEY}`,
                "Content-Type": "application/sdp",
            },
        });

        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };
        await pc.setRemoteDescription(answer);
        console.log("6. Remote description ayarlandı");

        // Şimdi DataChannel'ı oluştur
        const dc = pc.createDataChannel("oai-events");
        console.log("7. DataChannel oluşturuldu");

        // DataChannel'ın açılmasını bekle
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("DataChannel timeout"));
            }, 15000); // 15 saniye bekle

            dc.onopen = () => {
                console.log("8. DataChannel açıldı!");
                clearTimeout(timeout);
                resolve();
            };

            dc.onerror = (error) => {
                console.error("DataChannel hatası:", error);
                clearTimeout(timeout);
                reject(error);
            };

            // State değişikliklerini izle
            dc.oniceconnectionstatechange = () => {
                console.log("ICE Connection State:", pc.iceConnectionState);
            };

            dc.onstatechange = () => {
                console.log("DataChannel State:", dc.readyState);
            };
        });

        setDataChannel(dc);
        peerConnection.current = pc;
        console.log("9. Session başarıyla başlatıldı");

    } catch (error) {
        console.error("Session başlatma hatası:", error);
        throw error;
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }



  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        console.log("Gelen mesaj:", JSON.parse(e.data));
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });

      dataChannel.addEventListener("open", () => {
        console.log("DataChannel açıldı!");
        setIsSessionActive(true);
        setEvents([]);
      });

      dataChannel.addEventListener("error", (error) => {
        console.error("DataChannel hatası:", error);
      });

      dataChannel.addEventListener("close", () => {
        console.log("DataChannel kapandı");
        setIsSessionActive(false);
      });
    }
  }, [dataChannel]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>realtime console</h1>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[380px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          <ToolPanel
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
          />
        </section>
      </main>
    </>
  );
}
