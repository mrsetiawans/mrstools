document.addEventListener('DOMContentLoaded', () => {
    const slides = document.querySelectorAll('.slide');
    const currentSlideNumEl = document.getElementById('currentSlideNum');
    const totalSlideNumEl = document.getElementById('totalSlideNum');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    const progressBar = document.getElementById('progressBar');

    let currentSlide = 0;
    const totalSlides = slides.length;

    // Initialize
    totalSlideNumEl.textContent = totalSlides;
    updateSlideView();

    function updateSlideView() {
        // Update slides
        slides.forEach((slide, index) => {
            if (index === currentSlide) {
                slide.classList.add('active');
            } else {
                slide.classList.remove('active');
            }
        });

        // Update slide number
        currentSlideNumEl.textContent = currentSlide + 1;

        // Update buttons
        prevBtn.disabled = (currentSlide === 0);
        nextBtn.disabled = (currentSlide === totalSlides - 1);

        // Update progress bar
        const progress = ((currentSlide + 1) / totalSlides) * 100;
        progressBar.style.width = `${progress}%`;

        // Render icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function showNextSlide() {
        if (currentSlide < totalSlides - 1) {
            currentSlide++;
            updateSlideView();
        }
    }

    function showPrevSlide() {
        if (currentSlide > 0) {
            currentSlide--;
            updateSlideView();
        }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            showNextSlide();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            showPrevSlide();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullScreen();
        } else if (e.key === 'Home') {
            e.preventDefault();
            currentSlide = 0;
            updateSlideView();
        } else if (e.key === 'End') {
            e.preventDefault();
            currentSlide = totalSlides - 1;
            updateSlideView();
        }
    });

    // Button navigation
    nextBtn.addEventListener('click', showNextSlide);
    prevBtn.addEventListener('click', showPrevSlide);

    // Fullscreen
    function toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.body.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullScreen);

    // Update fullscreen icon
    document.addEventListener('fullscreenchange', () => {
        const icon = document.fullscreenElement ? 'minimize' : 'maximize';
        fullscreenBtn.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });

    // Auto-advance for demo (optional - remove if not needed)
    // let autoAdvanceInterval;
    // const startAutoAdvance = () => {
    //     autoAdvanceInterval = setInterval(() => {
    //         if (currentSlide < totalSlides - 1) {
    //             showNextSlide();
    //         } else {
    //             clearInterval(autoAdvanceInterval);
    //         }
    //     }, 8000); // 8 seconds per slide
    // };

    // const stopAutoAdvance = () => {
    //     clearInterval(autoAdvanceInterval);
    // };

    // // Start auto-advance after 3 seconds of inactivity
    // let inactivityTimer;
    // const resetInactivityTimer = () => {
    //     clearTimeout(inactivityTimer);
    //     stopAutoAdvance();
    //     inactivityTimer = setTimeout(startAutoAdvance, 3000);
    // };

    // // Listen for user interactions
    // ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
    //     document.addEventListener(event, resetInactivityTimer, true);
    // });

    // resetInactivityTimer(); // Initialize the timer
});
