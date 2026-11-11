// Base URL of the AuthenTech backend (the detection API).
//
//   ""                                        same origin. Used when the whole project runs locally
//                                             (`run.bat` / `./run.sh`): the backend serves this page too.
//   "https://random-words.trycloudflare.com"  the address printed by a Cloudflare Tunnel. Used on Vercel.
//
// A free quick tunnel receives a new address on every start, so the value is updated after each restart
// (no trailing slash), then committed and pushed. See docs/DEPLOY.md.
window.AUTHENTECH_API = "https://minds-remedy-aurora-jenny.trycloudflare.com";
