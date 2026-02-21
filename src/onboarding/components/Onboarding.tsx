import React, { useState } from "react";
import { DEFAULT_SETTINGS } from "@/shared/types";
import { WelcomeStep } from "./WelcomeStep";
import { ConnectStep } from "./ConnectStep";
import { DoneStep } from "./DoneStep";

type Step = "welcome" | "connect" | "done";

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [serverUrl, setServerUrl] = useState(DEFAULT_SETTINGS.serverUrl);
  const [apiKey, setApiKey] = useState("");
  const [encryptionSecret, setEncryptionSecret] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("connect")} />}
      {step === "connect" && (
        <ConnectStep
          serverUrl={serverUrl}
          apiKey={apiKey}
          encryptionSecret={encryptionSecret}
          onServerUrlChange={setServerUrl}
          onApiKeyChange={setApiKey}
          onEncryptionSecretChange={setEncryptionSecret}
          onConnected={() => setStep("done")}
        />
      )}
      {step === "done" && <DoneStep />}
    </div>
  );
}
