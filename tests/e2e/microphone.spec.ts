import { test, expect } from "@playwright/test";

test("headed Chromium captures fake microphone audio and completes a WebRTC loopback", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.textContent = "Start microphone probe";
    document.body.appendChild(button);
    button.addEventListener("click", async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const track = stream.getAudioTracks()[0];
        document.body.dataset.micState = track.readyState;

        const audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const started = performance.now();
        const watchSignal = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const value of data) {
            const normalized = (value - 128) / 128;
            sum += normalized * normalized;
          }
          if (Math.sqrt(sum / data.length) > 0.01) document.body.dataset.micSignal = "true";
          if (!document.body.dataset.micSignal && performance.now() - started < 12000) requestAnimationFrame(watchSignal);
        };
        requestAnimationFrame(watchSignal);

        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();
        let receivedTrack = false;
        pc2.ontrack = () => { receivedTrack = true; document.body.dataset.loopbackTrack = "true"; };
        stream.getTracks().forEach(t => pc1.addTrack(t, stream));
        const waitIce = (pc: RTCPeerConnection) => new Promise<void>(resolve => {
          if (pc.iceGatheringState === "complete") return resolve();
          const onState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", onState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", onState);
          setTimeout(resolve, 10000);
        });
        const runLoopback = async () => {
          const offer = await pc1.createOffer();
          await pc1.setLocalDescription(offer);
          await waitIce(pc1);
          await pc2.setRemoteDescription(pc1.localDescription);
          const answer = await pc2.createAnswer();
          await pc2.setLocalDescription(answer);
          await waitIce(pc2);
          await pc1.setRemoteDescription(pc2.localDescription);
          const deadline = performance.now() + 15000;
          while (performance.now() < deadline && pc1.connectionState !== "connected") await new Promise(r => setTimeout(r, 100));
          document.body.dataset.loopbackState = pc1.connectionState;
          if (!receivedTrack) await new Promise(r => setTimeout(r, 500));
          document.body.dataset.loopbackTrack = receivedTrack ? "true" : document.body.dataset.loopbackTrack || "false";
        };
        void runLoopback().catch(error => { document.body.dataset.loopbackError = String(error); });
      } catch (error) {
        document.body.dataset.micError = String(error);
      }
    });
  });
  await page.getByRole("button", { name: "Start microphone probe" }).click();
  await expect.poll(() => page.locator("body").getAttribute("data-mic-state")).toBe("live");
  await expect.poll(() => page.locator("body").getAttribute("data-mic-signal")).toBe("true", { timeout: 20000 });
  await expect.poll(() => page.locator("body").getAttribute("data-loopback-state")).toBe("connected", { timeout: 20000 });
  await expect.poll(() => page.locator("body").getAttribute("data-loopback-track")).toBe("true", { timeout: 20000 });
  expect(await page.locator("body").getAttribute("data-mic-error")).toBeNull();
  expect(await page.locator("body").getAttribute("data-loopback-error")).toBeNull();
});
