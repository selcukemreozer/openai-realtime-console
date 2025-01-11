import { useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession, sendTextMessage, dataChannel }) {
  const [isActivating, setIsActivating] = useState(false);
  
  async function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    try {
      console.log("1. Session başlatılıyor...");
      await startSession();
      
      console.log("2. DataChannel durumu:", dataChannel?.readyState);
      
      // DataChannel'ın açık olduğundan emin ol
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 saniye maksimum bekleme (artırıldı)

        const checkChannel = () => {
          attempts++;
          console.log(`3. Deneme ${attempts}: DataChannel durumu:`, dataChannel?.readyState);
          
          if (dataChannel?.readyState === "open") {
            console.log("4. DataChannel hazır!");
            resolve();
          } else if (attempts >= maxAttempts) {
            reject(new Error("DataChannel bağlantı zaman aşımı"));
          } else {
            setTimeout(checkChannel, 100);
          }
        };

        // İlk kontrol öncesi kısa bir bekleme ekleyelim
        setTimeout(checkChannel, 1000);
      });
      
      // Bağlantı kurulduktan sonra kısa bir bekleme ekleyelim
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log("5. İlk mesaj gönderiliyor...");
      await sendTextMessage("Merhaba, Ben Emre. Türkçe konuş.");
      console.log("6. İlk mesaj gönderildi!");
      
    } catch (error) {
      console.error("Session başlatma hatası:", error);
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-red-600"}
        icon={<CloudLightning height={16} />}
        disabled={isActivating}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({ stopSession, sendTextMessage }) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="border border-gray-200 rounded-full p-4 flex-1"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button
        onClick={() => {
          if (message.trim()) {
            handleSendClientEvent();
          }
        }}
        icon={<MessageSquare height={16} />}
        className="bg-blue-400"
      >
        send text
      </Button>
      <Button onClick={stopSession} icon={<CloudOff height={16} />}>
        disconnect
      </Button>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  serverEvents,
  isSessionActive,
  dataChannel,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          serverEvents={serverEvents}
        />
      ) : (
        <SessionStopped 
          startSession={startSession}
          sendTextMessage={sendTextMessage}
          dataChannel={dataChannel}
        />
      )}
    </div>
  );
}
