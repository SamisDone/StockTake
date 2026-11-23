/**
 * Whether the landing plays its opening: the name typing out, the headline rising, the
 * card printing. It plays once per browser tab, the first time the page is opened there;
 * a reload, or coming back to the page in the same tab, shows it still (an entrance on
 * every load stops being an entrance). Never with reduced motion, never without script.
 *
 * Runs inline before the page paints, so nothing shows in its final place and then
 * jumps back to start. It marks <html data-intro> and takes the mark off once the
 * opening is over, so a later client navigation to the page doesn't replay it.
 */
export const INTRO_KEY = "stocktake-intro";

/** How long the opening runs, with room to spare: the mark comes off after this. */
const INTRO_MS = 4000;

export const INTRO_SCRIPT = `(function(){try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("${INTRO_KEY}"))return;sessionStorage.setItem("${INTRO_KEY}","1");d.dataset.intro="";setTimeout(function(){delete d.dataset.intro},${INTRO_MS})}catch(e){}})()`;
