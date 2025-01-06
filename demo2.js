// global document, window

window.addEventListener("load", async () => {
    var playlist;
    var options = {
        minor: "minus",     // how to render minor chords
        transpose: 0,       // number of half tones to transpose
        useH: false,        // use "H" instead of "B"
        hilite: true       // use hiliting
    };
    
    // Track currently highlighted measure
    var currentHighlight = null;
    
    function makePlaylist(text) {
        playlist = new Playlist(text);
        var chordsHtml = "";
        for (var i = 0; i < playlist.songs.length; i++) {
            chordsHtml += `<div id="song-${i}"></div>`;
        }
        document.getElementById("chords").innerHTML = chordsHtml;
        
        // Automatically render the first song
        if (playlist.songs.length > 0) {
            renderSong(0);
        }
    }
    
    // Keep the findMeasures function unchanged
    function findMeasures(container) {
        const cells = container.querySelectorAll('irr-cell');
        const measures = [];
        let currentCell = 0;

        while (currentCell < cells.length) {
            const cell = cells[currentCell];
            const hasLeftBar = cell.querySelector('irr-lbar');
            const hasRightBar = cell.querySelector('irr-rbar');

            // Skip cells until we find a measure start (left bar or cell after right bar)
            if (!hasLeftBar && !hasRightBar &&
                !(currentCell > 0 && cells[currentCell - 1].querySelector('irr-rbar'))) {
                currentCell++;
                continue;
            }

            // Find end of measure (next left bar or right bar)
            let endCell = currentCell + 1;
            while (endCell < cells.length) {
                const nextCell = cells[endCell];
                if (nextCell.querySelector('irr-lbar') || nextCell.querySelector('irr-rbar')) {
                    if (nextCell.querySelector('irr-rbar')) {
                        endCell++; // Include the right bar cell
                    }
                    break;
                }
                endCell++;
            }

            // Check if measure has any content or is a valid empty measure
            let measureHasContent = false;
            let measureCells = [];
            let hasStartBar = false;
            let hasEndBar = false;

            for (let i = currentCell; i < endCell; i++) {
                const cell = cells[i];
                // Check for chord content, repeat symbols, or N.C.
                const cellContent = cell.querySelector('irr-chord');
                const hasRepeatSymbol = cell.querySelector('.Repeated-Figure1, .Repeated-Figure2, .Repeated-Figure3');
                const hasNoChord = cell.querySelector('.No-Chord');

                // Track if we have proper measure boundaries
                if (cell.querySelector('irr-lbar')) hasStartBar = true;
                if (cell.querySelector('irr-rbar')) hasEndBar = true;

                if ((cellContent && cellContent.textContent.trim()) ||
                    hasRepeatSymbol ||
                    hasNoChord) {
                    measureHasContent = true;
                }
                measureCells.push(cell);
            }

            // Consider a measure valid if it either has content OR has proper bar boundaries
            if (measureHasContent || (hasStartBar && (hasEndBar || endCell < cells.length))) {
                measures.push(measureCells);
            }

            currentCell = endCell;
        }

        return measures;
    }
    
    function addMeasureClickHandlers(container) {
        const measures = findMeasures(container);
        
        measures.forEach((measureCells, index) => {
            measureCells.forEach(cell => {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', () => {
                    // Remove previous highlight
                    if (currentHighlight) {
                        currentHighlight.forEach(cell => {
                            const highlight = cell.querySelector('.irr-cell-highlight');
                            if (highlight) {
                                highlight.remove();
                            }
                        });
                    }
                    
                    // Add highlight to clicked measure
                    measureCells.forEach(cell => {
                        const highlight = document.createElement('div');
                        highlight.className = 'irr-cell-highlight';
                        cell.appendChild(highlight);
                    });
                    
                    currentHighlight = measureCells;
                    
                    // Dispatch custom event with measure index
                    const event = new CustomEvent('measureSelected', {
                        detail: { measureIndex: index }
                    });
                    document.dispatchEvent(event);
                });
            });
        });
    }
    
    function renderSong(index) {
        var song = playlist.songs[index];
        var r = new iRealRenderer;
        r.parse(song);
        song = r.transpose(song, options);
        var container = document.getElementById("song-" + index);
        container.innerHTML = `<h3>${song.title} (${song.key
            .replace(/b/g, "\u266d")
            .replace(/#/g, "\u266f")})</h3><h5>${song.composer}</h5>`;
        r.render(song, container, options);
        
        addMeasureClickHandlers(container);
    }

    // Function to highlight a specific measure
    window.highlightMeasure = function(measureIndex) {
        const container = document.querySelector('[id^="song-"]');
        if (!container) return;
        
        const measures = findMeasures(container);
        if (measureIndex >= 0 && measureIndex < measures.length) {
            measures[measureIndex][0].click();
        }
    };

    // Function to load playlist data
    window.loadPlaylist = function(playlistData) {
        makePlaylist(playlistData);
    };

    // Try to load demo playlist if available
    try {
        const response = await fetch("DemoPlaylist.html");
        if (response.ok) {
            const playlistData = await response.text();
            makePlaylist(playlistData);
        }
    } catch (error) {
        console.log("No demo playlist available");
    }
});
