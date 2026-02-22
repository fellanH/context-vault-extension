import React, { useState } from "react";
import { WelcomeStep } from "./WelcomeStep";
import { ConnectStep } from "./ConnectStep";
import { DoneStep } from "./DoneStep";

type Step = "welcome" | "connect" | "done";

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");

  return (
    <div className="min-h-screen flex items-center justify-center">
      {step === "welcome" && <WelcomeStep onNext={() => setStep("connect")} />}
      {step === "connect" && (
        <ConnectStep onConnected={() => setStep("done")} />
      )}
      {step === "done" && <DoneStep />}
    </div>
  );
}
