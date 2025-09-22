import type { Accessor } from "solid-js";

export function getId(): string {
  const url = window.location.href;
  const items = url.split("/");
  const id = items[items.length - 1];
  return id;
}

export async function getScreenshot(
  working: Accessor<boolean>,
  setWorking: (working: boolean) => void,
) {
  async function request() {
    if (working()) return;
    setWorking(true);

    const id = getId();
    const evtSource = new EventSource(`/api/screenshot?id=${id}`);

    evtSource.onmessage = (event) => {
      console.log(event);
      const data = JSON.parse(event.data);
      console.log(data);

      if (data.status === "done") {
        // Convert array to bytes → blob
        const byteArray = new Uint8Array(data.data);
        const blob = new Blob([byteArray], { type: "image/png" });
        const url = URL.createObjectURL(blob);

        // Trigger download
        const a = document.createElement("a");
        a.href = url;
        a.download = "screenshot.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup
        URL.revokeObjectURL(url);
        evtSource.close();
        setWorking(false);
        return; // very important, stop handler here
      }

      if (data.status === "waiting") {
        alert("Screenshot queued, will download once ready.");
      }
    };

    evtSource.onerror = (err) => {
      console.error("SSE error:", err);
      evtSource.close();
      setWorking(false);
      return;
    };
  }
  await request();
}
