document.addEventListener('DOMContentLoaded', function () {

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ────────────────────────────────────────────
       Cosmic starfield canvas
    ──────────────────────────────────────────── */
    var canvas = document.getElementById('cosmic-canvas');

    if (canvas && !reduceMotion) {
        var ctx = canvas.getContext('2d');
        var w = 0, h = 0, dpr = 1;
        var stars = [];
        var shooting = [];
        var sparks = [];
        var mouseX = 0, mouseY = 0;
        var scrollY = window.scrollY || 0;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function starColor(hue, alpha) {
            if (hue === 'gold') return 'rgba(255, 215, 0, ' + alpha + ')';
            if (hue === 'violet') return 'rgba(180, 160, 255, ' + alpha + ')';
            return 'rgba(224, 224, 236, ' + alpha + ')';
        }

        function makeStars() {
            stars = [];
            var count = Math.min(200, Math.max(60, Math.floor((w * h) / 9000)));
            for (var i = 0; i < count; i++) {
                var depth = Math.random();
                var roll = Math.random();
                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.5 + depth * 2,
                    baseAlpha: 0.35 + Math.random() * 0.65,
                    twinkleSpeed: 0.4 + Math.random() * 1.4,
                    twinklePhase: Math.random() * Math.PI * 2,
                    depth: depth,
                    hue: roll < 0.18 ? 'gold' : (roll < 0.32 ? 'violet' : 'white')
                });
            }
        }

        function spawnShootingStar() {
            var startX = Math.random() * w * 0.6 + w * 0.2;
            var angle = Math.PI / 4 + (Math.random() * 0.3 - 0.15);
            var speed = 9 + Math.random() * 6;
            shooting.push({
                x: startX,
                y: -20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                length: 80 + Math.random() * 60
            });
        }

        function scheduleShootingStar() {
            var delay = 2800 + Math.random() * 5500;
            setTimeout(function () {
                if (!document.hidden) spawnShootingStar();
                scheduleShootingStar();
            }, delay);
        }

        function spawnBurst(x, y) {
            var count = 30;
            for (var i = 0; i < count; i++) {
                var angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
                var speed = 2 + Math.random() * 4.5;
                sparks.push({
                    x: x, y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    decay: 0.012 + Math.random() * 0.013,
                    r: 1.4 + Math.random() * 2.6,
                    hue: Math.random() < 0.5 ? 'gold' : 'violet'
                });
            }
        }

        function draw(time) {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#08080f';
            ctx.fillRect(0, 0, w, h);

            var parallaxX = (mouseX - w / 2) / w;
            var parallaxY = (mouseY - h / 2) / h;

            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                var tw = 0.6 + 0.4 * Math.sin(time * 0.001 * s.twinkleSpeed + s.twinklePhase);
                var alpha = s.baseAlpha * tw;
                var offsetX = parallaxX * s.depth * 24;
                var offsetY = parallaxY * s.depth * 24 + scrollY * s.depth * 0.04;
                var y = (s.y + offsetY) % (h + 40);
                if (y < 0) y += (h + 40);
                ctx.beginPath();
                ctx.arc(s.x + offsetX, y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = starColor(s.hue, alpha);
                ctx.fill();
            }

            for (var j = shooting.length - 1; j >= 0; j--) {
                var sh = shooting[j];
                sh.x += sh.vx;
                sh.y += sh.vy;
                sh.life -= 0.012;
                if (sh.life <= 0 || sh.y > h + 50 || sh.x > w + 50) {
                    shooting.splice(j, 1);
                    continue;
                }
                var tailX = sh.x - sh.vx * (sh.length / 10);
                var tailY = sh.y - sh.vy * (sh.length / 10);
                var grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
                grad.addColorStop(0, 'rgba(255,255,255,' + sh.life + ')');
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.strokeStyle = grad;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sh.x, sh.y);
                ctx.lineTo(tailX, tailY);
                ctx.stroke();
            }

            for (var k = sparks.length - 1; k >= 0; k--) {
                var sp = sparks[k];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.vx *= 0.96;
                sp.vy *= 0.96;
                sp.life -= sp.decay;
                if (sp.life <= 0) { sparks.splice(k, 1); continue; }
                ctx.shadowBlur = 12;
                ctx.shadowColor = sp.hue === 'gold' ? 'rgba(255,215,0,0.8)' : 'rgba(180,160,255,0.8)';
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, sp.r * sp.life, 0, Math.PI * 2);
                ctx.fillStyle = starColor(sp.hue, sp.life);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            requestAnimationFrame(draw);
        }

        window.addEventListener('scroll', function () {
            scrollY = window.scrollY;
        }, { passive: true });

        window.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        window.addEventListener('click', function (e) {
            spawnBurst(e.clientX, e.clientY);
        });

        window.addEventListener('resize', function () {
            resize();
            makeStars();
        });

        resize();
        makeStars();
        scheduleShootingStar();
        requestAnimationFrame(draw);
    }

    /* ────────────────────────────────────────────
       Flying saucer
    ──────────────────────────────────────────── */
    var ufo = document.getElementById('ufo');

    if (ufo && !reduceMotion) {
        var scheduleUfo = function () {
            var delay = 18000 + Math.random() * 27000; // 18s - 45s between flights
            setTimeout(flyUfo, delay);
        };

        var flyUfo = function () {
            if (document.hidden) {
                scheduleUfo();
                return;
            }
            var ltr = Math.random() < 0.5;
            var duration = 16 + Math.random() * 10; // 16s - 26s crossing
            var top = 6 + Math.random() * 45; // vh, roams the upper half

            ufo.classList.remove('flying-ltr', 'flying-rtl');
            ufo.style.setProperty('--ufo-duration', duration + 's');
            ufo.style.top = top + 'vh';

            // force reflow so the animation restarts cleanly
            void ufo.offsetWidth;
            ufo.classList.add(ltr ? 'flying-ltr' : 'flying-rtl');
        };

        ufo.addEventListener('animationend', function () {
            ufo.classList.remove('flying-ltr', 'flying-rtl');
            scheduleUfo();
        });

        // first pass happens a little sooner so it's noticed
        setTimeout(flyUfo, 5000);
    }

    /* ────────────────────────────────────────────
       Scroll reveal + glow-card spotlight
    ──────────────────────────────────────────── */
    var revealSelector = '.hero-block, .game-card, .project-card, .music-link, .fanart-item, ' +
        '.section-title, .section-subtitle, .featured-game, .music-intro, ' +
        '.hero-tagline, .hero-description';
    var revealEls = document.querySelectorAll(revealSelector);

    revealEls.forEach(function (el, i) {
        el.classList.add('reveal');
        el.style.setProperty('--stagger-i', i % 8);
    });

    if ('IntersectionObserver' in window && !reduceMotion) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        revealEls.forEach(function (el) { io.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    }

    var glowSelector = '.hero-block, .game-card, .project-card, .music-link';
    var glowEls = document.querySelectorAll(glowSelector);

    glowEls.forEach(function (el) {
        el.classList.add('glow-card');
        el.addEventListener('mousemove', function (e) {
            var rect = el.getBoundingClientRect();
            el.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
            el.style.setProperty('--my', (e.clientY - rect.top) + 'px');
        });
    });

});
