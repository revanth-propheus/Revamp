import gsap from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { ScrollTrigger } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm";
import { MotionPathPlugin } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/MotionPathPlugin/+esm";
import Lenis from "https://cdn.jsdelivr.net/npm/lenis@1.1.18/+esm";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

// ─── Intro Video loading Screen ───
const introLoadingScreen = document.getElementById("intro-loading-screen");
const introVideo = document.getElementById("intro-video");
if (introVideo) {
    introVideo.playbackRate = 0.70; // Slow down the intro video

    // The moment the video actually buffers and paints the first frame, 
    // fade out the solid loading background to begin the transparent reveal sequence
    introVideo.addEventListener("playing", () => {
        if (introLoadingScreen) {
            introLoadingScreen.style.backgroundColor = "transparent";
        }
    });
}
let introComplete = false;

// Bulletproof Hard Refresh Detection: 
// Checks if you are holding "Shift" right as the page unloads (Cmd+Shift+R)
let isShiftHeld = false;
window.addEventListener("keydown", (e) => { if (e.key === "Shift") isShiftHeld = true; });
window.addEventListener("keyup", (e) => { if (e.key === "Shift") isShiftHeld = false; });

window.addEventListener("beforeunload", () => {
    if (isShiftHeld) {
        sessionStorage.removeItem("introPlayed");
    }
    // Zero out native scroll before page unloads to stop active momentum
    window.scrollTo(0, 0);
});

// Check if the intro has already played this session
let hasIntroPlayed = sessionStorage.getItem("introPlayed") === "true";

// As requested: Force the intro to always play on every single refresh for mobile devices
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 950;
if (isMobileDevice) {
    hasIntroPlayed = false;
    sessionStorage.removeItem("introPlayed"); // Keep it clean
}

// Mobile plays the hero GIF exactly once, starting the moment the intro video ends.
// Same artwork, but with the GIF's loop count set to 1 so it freezes on the last frame.
const ONCE_GIF = "assets/revamp_gif2_once.gif";
const isNarrowScreen = () => window.innerWidth <= 768;
if (isNarrowScreen()) {
    const preload = new Image();
    preload.src = ONCE_GIF; // warm the cache while the intro video is on screen
}

function finishIntro() {
    if (introComplete) return;
    introComplete = true;
    document.body.classList.remove("intro-locked");
    lenis.start();

    // Swapping the src restarts playback from frame 0 — so the single run begins
    // now, in view, rather than having looped away behind the intro overlay.
    if (isNarrowScreen()) {
        const gif = document.querySelector(".hero-gif");
        if (gif) gif.src = ONCE_GIF;
    }

    if (introLoadingScreen) {
        introLoadingScreen.style.opacity = "0";
        setTimeout(() => {
            introLoadingScreen.style.display = "none";
        }, 1000); // 1s matches the CSS transition time
    }

    sessionStorage.setItem("introPlayed", "true");
}

// ─── Smooth scrolling with Lenis ───
const lenis = new Lenis();
// Instantly reset lenis to the top and kill any lingering scroll momentum from native browser
lenis.scrollTo(0, { immediate: true });

if (hasIntroPlayed) {
    // Skip intro entirely on standard reloads
    introComplete = true;
    if (introLoadingScreen) {
        introLoadingScreen.style.display = "none";
    }
    if (introVideo) {
        introVideo.pause(); // stop the video from playing in background
    }
} else {
    // Lock scroll initially for new sessions / hard reloads
    document.body.classList.add("intro-locked");
    lenis.stop(); // stopped until intro finishes

    // Auto-finish after Video ends (or if it crashes/fails to load)
    if (introVideo) {
        // Mobile browsers (specifically Safari) mandate the properties be explicitly true 
        // in JS before programmatic play, regardless of HTML attributes
        introVideo.muted = true;
        introVideo.playsInline = true;

        // Fallback for browsers (Chrome) that might outright reject Apple's MOV alpha format
        introVideo.addEventListener("ended", finishIntro);
        introVideo.addEventListener("error", finishIntro);
        // We REMOVED the "stalled" event listener here because cellular mobile connections 
        // frequently temporarily stop buffering to save data, which was causing the intro to falsely skip!

        // Force a programmatic play attempt (fixes Some Safari strict autoplay rules)
        let playPromise = introVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(_ => finishIntro()); // If browser aggressively blocks (like Low Power Mode), just skip 
        }
    } else {
        setTimeout(finishIntro, 3000);
    }

    // Skip intro on any scroll attempt (wheel), but NOT purely touch to prevent accidental
    // instant-skips by resting a thumb on mobile screens while loading.
    window.addEventListener("wheel", finishIntro, { once: true });
}

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// ─── Mobile portrait: hero GIF holds the first screen, the rest rises to meet it ───
// The hero is 100vh with the GIF centred, so on load the GIF sits alone in the middle
// of the screen. The GIF never moves: we pin the hero and slide EVERYTHING BELOW it
// (the road + the story section) upwards by the empty space under the GIF, so the road
// climbs up and joins the GIF's bottom edge. That shift stays applied afterwards —
// it IS the resting layout — with a matching negative margin so the document doesn't
// grow a blank tail.
let heroPinDistance = 0; // px of scroll the pinned hero eats; road draw waits this long
const isMobilePortrait = () =>
    window.innerWidth <= 768 && window.matchMedia("(orientation: portrait)").matches;

const heroGif = document.querySelector(".hero-gif");
const belowHero = [document.querySelector(".spotlight"), document.querySelector(".story-section")].filter(Boolean);

if (heroGif && belowHero.length) {
    gsap.matchMedia().add("(max-width: 768px) and (orientation: portrait)", () => {
        // Blank space under the centred GIF, less the 20px the road start overlaps by.
        const slack = () => Math.max(0, (window.innerHeight - heroGif.offsetHeight) / 2 - 20);
        heroPinDistance = slack();

        const tween = gsap.fromTo(belowHero,
            { y: 0 },
            {
                y: () => -slack(),
                ease: "none",
                scrollTrigger: {
                    trigger: ".hero",
                    start: "top top",
                    end: () => "+=" + slack(),
                    pin: true,
                    scrub: 0.6,
                    invalidateOnRefresh: true,
                    onRefresh: () => { heroPinDistance = slack(); },
                }
            });

        // Pull the page end up by the same amount the content was lifted.
        const last = belowHero[belowHero.length - 1];
        gsap.set(last, { marginBottom: () => -slack() });

        return () => {
            heroPinDistance = 0;
            tween.scrollTrigger && tween.scrollTrigger.kill();
            gsap.set(belowHero, { clearProps: "transform" });
            gsap.set(last, { clearProps: "marginBottom" });
        };
    });
}

// ─── SVG Path draw-on-scroll ───
const path = document.getElementById("stroke-path");
if (path) {
    const pathLength = path.getTotalLength();
    // Add extra padding to the gap and offset it off-screen 
    // to cleanly hide the rounded end-cap at scroll = 0
    path.style.strokeDasharray = `${pathLength} ${pathLength + 50}`;
    path.style.strokeDashoffset = pathLength + 20;

    gsap.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
            trigger: ".spotlight",
            start: () => {
                // Determine starting position dynamically depending on orientation
                let boundingTop = document.querySelector(".spotlight").getBoundingClientRect().top;

                // If we are in mobile landscape, wait until the user has actually scrolled 
                // lower into the page before starting the line drawing to avoid it finishing out-of-frame
                const isMobileLandscape = window.innerWidth <= 950 && window.matchMedia("(orientation: landscape)").matches;
                if (isMobileLandscape) {
                    // Start much later (further down) and visually catch up 
                    return "top " + (boundingTop - 100) + "px";
                }

                // Mobile portrait pins the hero for heroPinDistance px before the road even
                // reaches the GIF — hold the drawing back by that much so it isn't already
                // part-drawn by the time it first appears.
                if (isMobilePortrait() && heroPinDistance) {
                    return "top " + (boundingTop - heroPinDistance) + "px";
                }

                return "top " + boundingTop + "px";
            },
            end: () => {
                const isMobileLandscape = window.innerWidth <= 950 && window.matchMedia("(orientation: landscape)").matches;
                if (isMobileLandscape) {
                    // Finish the curve much quicker in landscape so it outpaces the scrolling speed
                    return "bottom 40%";
                }
                // The road now runs ~28% of the section's height BELOW .spotlight's box
                // (Profile 7 + the ending box). Stretch the scrub that far so the drawing
                // finishes when the real tail enters the viewport, not a screen early.
                const spotlight = document.querySelector(".spotlight");
                const tail = spotlight.getBoundingClientRect().height * 0.28;
                return "bottom " + Math.round(window.innerHeight - tail) + "px";
            },
            scrub: 0.5,
            invalidateOnRefresh: true, // Re-calculates if mobile screen rotates
        }
    });
}

// ─── Reveal profile cards & ending box on scroll ───
document.querySelectorAll(".reveal").forEach((el) => {
    gsap.to(el, {
        opacity: 1,
        y: 0,
        rotation: 0, // In case any initial rotation is applied
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
            trigger: el,
            start: "top 85%",
            end: "top 50%",
            toggleActions: "play none none reverse",
        }
    });
});

// ─── Floating Aeroplanes (MotionPath + Drawn Dotted Trail) ───
[1, 2, 3, 4].forEach((n, i) => {
    const flightPath = document.getElementById(`flight-path-${n}`);
    const trailPath = document.getElementById(`trail-path-${n}`);
    const maskPath = document.getElementById(`mask-path-${n}`);
    const planeIcon = document.getElementById(`plane-${n}`);
    if (!flightPath || !trailPath || !maskPath || !planeIcon) return;

    const totalLen = maskPath.getTotalLength();
    let dur = 9 + i * 2; // staggered durations
    if (n === 4) {
        dur = 6; // make the globe orbit plane much faster
    }

    // Initialize mask as invisible (hidden via dashoffset)
    gsap.set(maskPath, { strokeDasharray: totalLen, strokeDashoffset: totalLen });
    gsap.set(trailPath, { opacity: 0.35 });
    gsap.set(planeIcon, { opacity: 0.7 });

    const tl = gsap.timeline({ repeat: -1, delay: n === 4 ? 0 : i * 3 });

    // Draw trail (mask dashoffset → 0) and fly plane along path simultaneously
    tl.to(maskPath, { strokeDashoffset: 0, duration: dur, ease: "none" }, 0);
    tl.to(planeIcon, {
        duration: dur,
        ease: "none",
        motionPath: {
            path: flightPath,
            align: flightPath,
            alignOrigin: [0.5, 0.5],
            autoRotate: true
        }
    }, 0);

    // Fade out both plane + trail before reset
    tl.to([trailPath, planeIcon], { opacity: 0, duration: 1.2 }, dur - 1);

    // Reset trail and plane position for a clean loop restart
    tl.set(maskPath, { strokeDashoffset: totalLen });
    tl.set(trailPath, { opacity: 0.35 });
    tl.set(planeIcon, { opacity: 0.7 });
});

// ─── Story Title Left-to-Right Fill Animation ───
const storyTitle = document.querySelector(".story-title-anim");
if (storyTitle) {
    gsap.to(storyTitle, {
        backgroundPosition: "0% 0%",
        ease: "none",
        scrollTrigger: {
            trigger: ".story-section",
            start: "top 75%",
            end: "top 30%",
            scrub: true,
        }
    });
}