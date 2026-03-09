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
});

// Check if the intro has already played this session
const hasIntroPlayed = sessionStorage.getItem("introPlayed") === "true";

function finishIntro() {
    if (introComplete) return;
    introComplete = true;
    document.body.classList.remove("intro-locked");
    lenis.start();

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
        // Fallback for browsers (Chrome) that might outright reject Apple's MOV alpha format
        introVideo.addEventListener("ended", finishIntro);
        introVideo.addEventListener("error", finishIntro);
        introVideo.addEventListener("stalled", finishIntro);

        // Force a programmatic play attempt (fixes Some Safari strict autoplay rules)
        let playPromise = introVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(_ => finishIntro()); // If browser aggressively blocks, just skip 
        }
    } else {
        setTimeout(finishIntro, 3000);
    }

    // Skip intro on any scroll attempt (wheel/touch)
    window.addEventListener("wheel", finishIntro, { once: true });
    window.addEventListener("touchstart", finishIntro, { once: true });
}

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

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
            start: "top 80%",
            end: "bottom 40%",
            scrub: 0.5,
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
[1, 2, 3].forEach((n, i) => {
    const flightPath = document.getElementById(`flight-path-${n}`);
    const trailPath = document.getElementById(`trail-path-${n}`);
    const maskPath = document.getElementById(`mask-path-${n}`);
    const planeIcon = document.getElementById(`plane-${n}`);
    if (!flightPath || !trailPath || !maskPath || !planeIcon) return;

    const totalLen = maskPath.getTotalLength();
    const dur = 9 + i * 2; // staggered durations

    // Initialize mask as invisible (hidden via dashoffset)
    gsap.set(maskPath, { strokeDasharray: totalLen, strokeDashoffset: totalLen });
    gsap.set(trailPath, { opacity: 0.35 });
    gsap.set(planeIcon, { opacity: 0.7 });

    const tl = gsap.timeline({ repeat: -1, delay: i * 3 });

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