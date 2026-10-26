/**
 * Head Mistress requisition flow.
 * Same shape as the complaint flow: one chat call, then exit on success, cancel, or startup failure.
 */

import { aiAPI } from "../../services/api";

const REQUISITION_ERR =
  "Sorry, there was an error processing your requisition request.";

export type RequisitionBotMessage =
  | { type: "bot"; answer: string; activeTab: "answer" }
  | { type: "bot"; text: string };

export function getRequisitionExitDelayMs(
  spokenText: string,
  isVoiceTriggered: boolean,
): number {
  if (!isVoiceTriggered) {
    return 1000;
  }
  const generationSlackMs = 3000;
  return Math.min(
    12000,
    Math.max(5000, spokenText.length * 55 + generationSlackMs),
  );
}

export interface RequisitionFlowCallbacks {
  appendBotMessage: (msg: RequisitionBotMessage) => void;
  exitFlow: () => void;
  exitFlowPreserveTTS?: () => void;
  exitFlowForManualExit?: () => void;
  setProcessing: (v: boolean) => void;
  playTTS: (index: number, text: string) => void;
  getTTSSummary: (text: string) => string;
}

export interface RequisitionChatParams extends RequisitionFlowCallbacks {
  userMessage: string;
  sessionId: string | null;
  userId: string;
  userRoles?: string[];
  isVoiceTriggered: boolean;
  getErpContext: () => { academic_session: string; branch_token: string };
}

export function shouldExitRequisitionOnStartError(answer: string): boolean {
  return answer.toLowerCase().includes("something went wrong. please try again.");
}

export function shouldExitRequisitionOnCancel(answer: string): boolean {
  return answer.toLowerCase().includes("exited. how can i help you next");
}

export function shouldExitRequisitionOnSuccess(answer: string): boolean {
  const text = answer.toLowerCase();
  return text.includes("requisition request") && text.includes("submitted");
}

export async function runRequisitionChat(params: {
  sessionId: string | null;
  userId: string;
  userRoles?: string[];
  query: string;
  isVoiceTriggered: boolean;
  getErpContext: () => { academic_session: string; branch_token: string };
}): Promise<{
  success: boolean;
  data?: { answer?: string; tts_text?: string };
  error?: string;
}> {
  const authToken = localStorage.getItem("token");
  const { academic_session, branch_token } = params.getErpContext();
  try {
    const data = await aiAPI.requisitionChat({
      session_id: params.sessionId || params.userId,
      user_id: params.userId,
      user_roles: params.userRoles,
      query: params.query,
      bearer_token: authToken || undefined,
      academic_session,
      branch_token,
      voice_mode: params.isVoiceTriggered,
      tts: params.isVoiceTriggered,
    });
    if (data.status === "success" && data.data) {
      return { success: true, data: data.data };
    }
    return {
      success: false,
      error: data.message || REQUISITION_ERR,
    };
  } catch {
    return { success: false, error: REQUISITION_ERR };
  }
}

export async function handleRequisitionChat(
  params: RequisitionChatParams,
): Promise<void> {
  const {
    userMessage,
    sessionId,
    userId,
    userRoles,
    isVoiceTriggered,
    getErpContext,
    appendBotMessage,
    exitFlow,
    exitFlowPreserveTTS,
    exitFlowForManualExit,
    setProcessing,
    playTTS,
    getTTSSummary,
  } = params;

  const scheduleFlowExit = (spokenText: string) => {
    const delayMs = getRequisitionExitDelayMs(spokenText, isVoiceTriggered);
    const doExit = isVoiceTriggered
      ? (exitFlowPreserveTTS ?? exitFlow)
      : exitFlow;
    setTimeout(doExit, delayMs);
  };

  let showedAnswer = false;
  try {
    const result = await runRequisitionChat({
      sessionId,
      userId,
      userRoles,
      query: userMessage,
      isVoiceTriggered,
      getErpContext,
    });

    if (result.success && result.data) {
      const answer = result.data.answer || "";
      const ttsText = result.data.tts_text;
      showedAnswer = true;

      appendBotMessage({ type: "bot", answer, activeTab: "answer" });

      if (isVoiceTriggered) {
        try {
          const textToSpeak =
            ttsText != null && ttsText !== "" ? ttsText : getTTSSummary(answer);
          playTTS(-1, textToSpeak);
        } catch (ttsErr) {
          console.error("Requisition TTS playback failed:", ttsErr);
        }
      }

      const isExitResponse =
        answer.toLowerCase().includes("you've exited the requisition") ||
        (answer.includes("✅") && answer.toLowerCase().includes("exited"));
      if (isExitResponse) {
        (exitFlowForManualExit ?? exitFlow)();
        setProcessing(false);
        return;
      }

      if (shouldExitRequisitionOnStartError(answer)) {
        try {
          exitFlow();
        } catch (exitErr) {
          console.error("Requisition exit after startup error failed:", exitErr);
        }
        return;
      }

      if (shouldExitRequisitionOnCancel(answer)) {
        const spoken =
          ttsText != null && ttsText !== ""
            ? ttsText
            : "The request has been cancelled.";
        scheduleFlowExit(spoken);
        return;
      }

      if (shouldExitRequisitionOnSuccess(answer)) {
        const spoken =
          ttsText != null && ttsText !== "" ? ttsText : getTTSSummary(answer);
        scheduleFlowExit(spoken);
      }
    } else {
      const errMsg = result.error || REQUISITION_ERR;
      appendBotMessage({ type: "bot", text: errMsg });
      if (isVoiceTriggered) {
        try {
          playTTS(-1, getTTSSummary(errMsg));
        } catch (ttsErr) {
          console.error("Requisition TTS playback failed:", ttsErr);
        }
      }
    }
  } catch {
    if (!showedAnswer) {
      appendBotMessage({ type: "bot", text: REQUISITION_ERR });
      if (params.isVoiceTriggered) {
        try {
          params.playTTS(-1, params.getTTSSummary(REQUISITION_ERR));
        } catch (ttsErr) {
          console.error("Requisition TTS playback failed:", ttsErr);
        }
      }
    }
  } finally {
    setProcessing(false);
  }
}
