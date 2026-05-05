import { toast } from "sonner";
import type { CommandId } from "./commands";

export interface ActionContext {
  openCamera: () => void;
  toggleTorch: () => Promise<void>;
  playMusic: () => Promise<void>;
  pauseMusic: () => void;
}

const MOM_NUMBER = "+10000000000"; // TODO: replace with real number

export async function runCommand(id: CommandId, ctx: ActionContext): Promise<string> {
  switch (id) {
    case "call":
      window.location.href = `tel:${MOM_NUMBER}`;
      return "Calling Mom…";
    case "sms":
      window.location.href = `sms:${MOM_NUMBER}`;
      return "Opening messages…";
    case "camera":
      ctx.openCamera();
      return "Opening camera…";
    case "torch":
      await ctx.toggleTorch();
      return "Toggling torch…";
    case "music_play":
      await ctx.playMusic();
      return "Playing music";
    case "music_pause":
      ctx.pauseMusic();
      return "Music paused";
    case "whatsapp":
      window.open("https://wa.me/", "_blank");
      return "Opening WhatsApp…";
    case "maps":
      window.open("https://maps.google.com", "_blank");
      return "Opening Maps…";
    case "youtube":
      window.open("https://youtube.com", "_blank");
      return "Opening YouTube…";
    case "gmail":
      window.open("https://mail.google.com", "_blank");
      return "Opening Gmail…";
    case "browser":
      window.open("https://google.com", "_blank");
      return "Opening Google…";
    case "time": {
      const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      toast.success(`It's ${t}`);
      return `It's ${t}`;
    }
    case "stop":
      return "Stopped";
  }
}