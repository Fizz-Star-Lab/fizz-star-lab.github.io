document.addEventListener('DOMContentLoaded', function () {

    var GITHUB_OWNER = 'Fizz-Star-Lab';
    var GITHUB_REPO = 'fizz-star-lab.github.io';
    var GITHUB_BRANCH = 'main';
    var FANARTS_PATH = 'fanarts';

    var gallery = document.getElementById('fanarts-gallery');
    if (!gallery) return;

    var IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
    var localPreviewApplied = false;

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
        return arr;
    }

    var apiUrl = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO +
        '/contents/' + FANARTS_PATH + '?ref=' + GITHUB_BRANCH;

    fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (res) {
            if (!res.ok) throw new Error('GitHub API responded ' + res.status);
            return res.json();
        })
        .then(function (files) {
            if (!Array.isArray(files)) throw new Error('Unexpected GitHub API response');

            var images = shuffle(files.filter(function (f) {
                return f.type === 'file' && IMAGE_EXT.test(f.name);
            }));

            // Nothing uploaded yet — leave the gallery as-is.
            if (images.length === 0 || localPreviewApplied) return;

            gallery.innerHTML = '';

            images.forEach(function (file, i) {
                var a = document.createElement('a');
                a.className = 'fanart-item';
                a.href = file.download_url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.style.backgroundImage = "url('" + file.download_url + "')";
                a.style.setProperty('--stagger-i', i % 8);
                gallery.appendChild(a);
            });

            revealItems(gallery.querySelectorAll('.fanart-item'));
        })
        .catch(function (err) {
            // Network hiccup, rate limit, or repo not reachable — nothing to
            // render, but at least it fails quietly instead of breaking the page.
            console.warn('Fanarts: could not load from GitHub.', err);
        });

    // ── Local-only preview (no push required) ──
    // GitHub API above only ever sees what's actually committed & pushed.
    // When this page is opened straight from disk (file://), show a button
    // that lets you pick the local fanarts/ folder and preview it instantly.
    if (window.location.protocol === 'file:') {
        var devTools = document.getElementById('fanarts-devtools');
        var localBtn = document.getElementById('fanarts-local-preview-btn');
        var localInput = document.getElementById('fanarts-local-input');

        if (devTools && localBtn && localInput) {
            devTools.hidden = false;

            localBtn.addEventListener('click', function () {
                localInput.click();
            });

            localInput.addEventListener('change', function () {
                var files = shuffle(Array.prototype.slice.call(localInput.files)
                    .filter(function (f) { return IMAGE_EXT.test(f.name); }));

                if (files.length === 0) return;

                localPreviewApplied = true;
                gallery.innerHTML = '';

                files.forEach(function (file, i) {
                    var url = URL.createObjectURL(file);
                    var a = document.createElement('a');
                    a.className = 'fanart-item';
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.style.backgroundImage = "url('" + url + "')";
                    a.style.setProperty('--stagger-i', i % 8);
                    gallery.appendChild(a);
                });

                revealItems(gallery.querySelectorAll('.fanart-item'));
            });
        }
    }

    function revealItems(items) {
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        items.forEach(function (el) { el.classList.add('reveal'); });

        if ('IntersectionObserver' in window && !reduceMotion) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

            items.forEach(function (el) { io.observe(el); });
        } else {
            items.forEach(function (el) { el.classList.add('is-visible'); });
        }
    }

});
