import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";

test.describe.configure({ mode: "serial" });

test("full voice interview flow with a real Chromium browser and fake microphone", async ({ page }, testInfo) => {
  test.setTimeout(8 * 60 * 1000);

  test.skip(
    !process.env.E2E_MOCK_AI && !process.env.OPENAI_API_KEY,
    "Set E2E_MOCK_AI=true for the no-cost CI simulation or provide OPENAI_API_KEY for a live OpenAI run.",
  );

  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("requestfailed", request => { failedRequests.push(request.url() + " :: " + (request.failure()?.errorText || "request failed")); });

  const resumePath = testInfo.outputPath("resume.txt");
  await fs.writeFile(resumePath, [
    "Raghunatha Reddy GR",
    "Target: MLOps Engineer",
    "Python, FastAPI, Docker, Kubernetes, PostgreSQL, React",
    "Built PlagiaScan using FastAPI, React, RoBERTa-BERT, MinHash, Qdrant, PostgreSQL and OCR.",
    "Built an AI Reliability Platform for MLOps with drift detection, model monitoring, retraining triggers and deployment automation.",
    "Experience with CI/CD, REST APIs, cloud deployment, machine learning pipelines and debugging production services."
  ].join("\n"), "utf8");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Turn your resume into a realistic interview." })).toBeVisible();
  await expect(page.getByText("demo@hirepilot.local")).toBeVisible();

  await page.getByLabel("Target role").fill("MLOps Engineer");
  await page.getByLabel("Job description").fill([
    "We are hiring an MLOps Engineer.",
    "Build and maintain production ML pipelines and model deployment systems.",
    "Strong Python, FastAPI, Docker, Kubernetes, PostgreSQL, CI/CD and cloud fundamentals.",
    "Experience with monitoring, drift detection, model evaluation, observability and debugging is required.",
    "Candidates should be able to explain architecture, implementation trade-offs and production incident response."
  ].join("\n"));
  await page.locator('input[type="file"]').setInputFiles(resumePath);
  await page.getByRole("button", { name: "Analyze resume & start interview" }).click();

  await expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/i, { timeout: 120000 });
  await expect(page.getByText("ATS + evidence map")).toBeVisible();

  await page.getByRole("button", { name: "Start Technical voice round" }).click();
  await expect(page.getByText("Your microphone is live", { exact: true })).toBeVisible({ timeout: 60000 });

  const transcript = page.locator(".transcript .msg");
  await expect(transcript).toHaveCount(2, { timeout: 120000 });
  const technicalText = await page.locator(".transcript").innerText();
  expect(technicalText.length).toBeGreaterThan(20);

  await page.getByRole("button", { name: "Finish & score" }).click();
  await expect(page.getByText(/Round score:/)).toBeVisible({ timeout: 120000 });
  await expect(page.getByText("Continue to HR / Behavioral")).toBeVisible();

  await page.getByRole("button", { name: "Continue to HR / Behavioral" }).click();
  await expect(page.getByRole("button", { name: "Start HR voice round" })).toBeVisible();
  await page.getByRole("button", { name: "Start HR voice round" }).click();
  await expect(page.getByText("Your microphone is live", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".transcript .msg")).toHaveCount(2, { timeout: 120000 });

  await page.getByRole("button", { name: "Finish & score" }).click();
  await expect(page.getByText(/Round score:/)).toBeVisible({ timeout: 120000 });
  await expect(page.getByRole("link", { name: "View final report" })).toBeVisible();
  await page.getByRole("link", { name: "View final report" }).click();

  await expect(page).toHaveURL(/\/report\/[0-9a-f-]{36}$/i);
  await expect(page.getByText("Senior recruiter brief")).toBeVisible();
  await expect(page.getByText("Technical", { exact: true })).toBeVisible();
  await expect(page.getByText("HR / Behavioral", { exact: true })).toBeVisible();

  expect(failedRequests, "Unexpected browser network failures").toEqual([]);
  expect(browserErrors, "Unexpected browser console errors").toEqual([]);
});
