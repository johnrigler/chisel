/* Chisel browser-native share driver: no wallet/signing state crosses this boundary. */
(function(root) {
  "use strict";
  function youtube(value) {
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
      const host = url.hostname.toLowerCase(), parts = url.pathname.split("/").filter(Boolean);
      let id = "";
      if (["youtu.be", "www.youtu.be"].includes(host)) id = parts[0] || "";
      else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
        if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
        else if (["shorts", "live", "embed", "v"].includes(parts[0])) id = parts[1] || "";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? {id, thumbnail:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg"} : null;
    } catch (_) { return null; }
  }
  function sendToChisel(endpoint, value, record) {
    if (typeof value !== "string" || !value.trim()) throw new Error("Share content is required.");
    const url = new URL(endpoint);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP or HTTPS Chisel address without credentials.");
    const fragment = new URLSearchParams(url.hash.slice(1));
    fragment.set("opreturn", value); fragment.delete("record");
    if (record != null) {
      if (record.opReturnText !== value) throw new Error("The shared record does not match OP_RETURN.");
      const json = JSON.stringify(record);
      if (new TextEncoder().encode(json).length > 65536) throw new Error("The rich record exceeds Chisel's 65,536-byte preview limit.");
      fragment.set("record", json);
    }
    url.hash = fragment.toString();
    url.searchParams.set("mode", "send");
    return url.href;
  }
  class ChiselShareDriver {
    constructor(kind) { this.kind = kind; }
    accepts(value) { return typeof value === "string" && !!value.trim(); }
    describe(value) { return {kind:this.kind,content:value}; }
    sendToChisel(endpoint, content, record) { return sendToChisel(endpoint,content,record); }
  }
  class YouTubeDriver extends ChiselShareDriver {
    constructor() { super("youtube"); }
    accepts(value) { return !!youtube(value); }
    describe(value) {
      const media = youtube(value);
      if (!media) throw new Error("Invalid YouTube video.");
      return {kind:"youtube", content:value, id:media.id, thumbnail:media.thumbnail};
    }
  }
  const youtubeDriver = Object.freeze(new YouTubeDriver());
  const genericDriver = Object.freeze(new ChiselShareDriver("link"));
  root.CHISEL_SHARE_DRIVER = Object.freeze({
    ChiselShareDriver, YouTubeDriver, youtube:youtubeDriver, generic:genericDriver, sendToChisel,
    forContent(value) { return youtubeDriver.accepts(value) ? youtubeDriver : genericDriver; }
  });
})(typeof window === "object" ? window : globalThis);
