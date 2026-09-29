// Shared by the <head> script (server layout) and the app (browser): no React imports here.
export const SIGNED_IN_FLAG = "mw-signed-in";
export const THEME_KEY = "mw-theme";   // "light" | "dark"; missing = follow the device (src/lib/theme.js)
export const bootScript = `try{if(localStorage.getItem("${SIGNED_IN_FLAG}"))document.documentElement.classList.add("returning");var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
