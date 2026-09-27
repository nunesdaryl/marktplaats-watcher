// Shared by the <head> script (server layout) and the app (browser): no React imports here.
export const SIGNED_IN_FLAG = "mw-signed-in";
export const bootScript = `try{if(localStorage.getItem("${SIGNED_IN_FLAG}"))document.documentElement.classList.add("returning")}catch(e){}`;
