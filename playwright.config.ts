import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const voiceWavPath = process.env.VOICE_WAV_PATH || path.resolve("tests/fixtures/voice.wav");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 8 * 60 * 1000,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: false,
    permissions: ["microphone"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${voiceWavPath}`,
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
