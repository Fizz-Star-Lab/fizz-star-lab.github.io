document.addEventListener('DOMContentLoaded', function () {

    // ── Mobile Navigation Toggle ──
    var toggle = document.getElementById('nav-toggle');
    var navList = document.getElementById('nav-list');

    if (toggle && navList) {
        toggle.addEventListener('click', function () {
            toggle.classList.toggle('active');
            navList.classList.toggle('open');
        });

        // Close menu when a nav link is clicked
        var navLinks = navList.querySelectorAll('a');
        for (var i = 0; i < navLinks.length; i++) {
            navLinks[i].addEventListener('click', function () {
                toggle.classList.remove('active');
                navList.classList.remove('open');
            });
        }
    }

    // ── Carousel ──
    var track = document.getElementById('carousel-track');
    if (!track) return;

    var slides = track.querySelectorAll('.carousel-item');
    var totalSlides = slides.length;
    if (totalSlides === 0) return;

    var index = 0;

    // Clone first and last slides for infinite loop
    var firstClone = slides[0].cloneNode(true);
    var lastClone = slides[totalSlides - 1].cloneNode(true);
    track.appendChild(firstClone);
    track.insertBefore(lastClone, slides[0]);

    function getSlideWidth() {
        return slides[0].clientWidth;
    }

    function setInitialPosition() {
        index = 0;
        track.style.transition = 'none';
        track.style.transform = 'translateX(-' + getSlideWidth() + 'px)';
    }

    setInitialPosition();

    setInterval(function () {
        index++;
        var width = getSlideWidth();
        track.style.transition = 'transform 0.5s ease';
        track.style.transform = 'translateX(' + (-width * (index + 1)) + 'px)';
    }, 3000);

    track.addEventListener('transitionend', function () {
        if (index >= totalSlides) {
            track.style.transition = 'none';
            index = 0;
            track.style.transform = 'translateX(-' + getSlideWidth() + 'px)';
        }
    });

    window.addEventListener('resize', setInitialPosition);

});
