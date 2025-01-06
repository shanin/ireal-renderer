// global document, window

const UI_HTML = `
<div id="ui">
  <div id="left-box">
    <select id="songs" multiple size="6"></select>
  </div>
  <div id="right-box">
    <div style="width:45%">
      <label>Minor chords display:</label>
      <div class="radio">
        <label><input type="radio" id="minus" name="minor" checked>Minus sign (Bb-)</label>
      </div>
      <div class="radio">
        <label><input type="radio" id="m" name="minor">Letter "m" (Bbm)</label>
      </div>
      <div class="radio">
        <label><input type="radio" id="small" name="minor">Small letters (bb)</label>
      </div>
      <br/>
      <div class="checkbox">
        <label><input type="checkbox" id="ui-useh">Use H for B chords</label>
      </div>
    </div>
    <table border="0" width="45%">
      <tr><td colspan="2">
        <div class="checkbox">
          <label><input type="checkbox" id="ui-hilite" checked>Highlighting</label>
        </div>
      </td></tr>
      <tr><td>
        <label for="ui-barnumber">Bar number: </label>
      </td><td>
        <input id = "ui-barnumber" type="number" value="0" min="0" max="256" style="display:inline; width:60px">
      </td></tr>
      <tr><td>
        <label for="ui-transpose">Transpose (half tones): </label>
      </td><td>
        <input id = "ui-transpose" type="number" value="0" min="-6" max="6" style="display:inline; width:60px">
      </tr><tr><td>
        <label for="ui-fontsize">Font size: </label>
      </td><td>
        <input id = "ui-fontsize" type="number" value="16" min="4" max="256" style="display:inline; width:60px">
      </td></tr>
      <tr><td colspan="2">
        <label for="ui-file">Select iReal Pro playlist: </label>
        <input type="file" id="ui-file" style="margin-top: 5px"/>
      </td></tr>
    </table>
  </div>
</div>
`;

const PAGE_HTML = `
<div id="page">
  <div id="chords" style="font-size:16pt"></div>
</div>
`;

const getReactProps = (element) => {
  for (const key in element) {
    if (key.startsWith('__reactProps$')) {
      return element[key];
    }
  }
};

/**
 * @typedef {Object} Region
 * @property {number} start - Region start time
 * @property {number} end - Region end time
 * @property {string[]} labels - Region labels
 */

const onLoad = async () => {
  console.log('DEMO2 YEEEEAH');
  const container = document.getElementById("ireal-container");
  const songTitle = container.innerText;
  container.innerHTML = UI_HTML + PAGE_HTML;
  document.body.appendChild(container);

  const LS_EL = parent.document.getElementsByClassName('lsf-audio-tag')[0].parentNode;
  console.log(LS_EL);
  /**
   * @constant {Region[]} regions - Array of regions
   */
  const regions = getReactProps(LS_EL).children[1].props.item._ws.regions.regions;

  var playlist;
  let selected;
  let measures;
  var options = {
    minor: "minus",
    transpose: 0,
    useH: false,
    hilite: true,
  };
  // Track currently highlighted measure
	let currentHighlight = null;

  function makePlaylist(text) {
    playlist = new Playlist(text);
    var lbHtml = "";
    var chordsHtml = "";
    for (var i = 0; i < playlist.songs.length; i++) {
      lbHtml += `<option value="${i}">${playlist.songs[i].title}</option>`;
      chordsHtml += `<div id="song-${i}"></div>`;
      if (playlist.songs[i].title === songTitle) {
        selected = i;
      }
    }
    document.getElementById("songs").innerHTML = lbHtml;
    document.getElementById("chords").innerHTML = chordsHtml;
  }

  /**
   * Render a song into the container "#song-index".
   * @param {int} index - the song index
   */
  function renderSong(index) {
    var song = playlist.songs[index];
    var r = new iRealRenderer();
    r.parse(song);
    song = r.transpose(song, options);
    var container = document.getElementById("song-" + index);
    container.innerHTML = `<h3>${song.title} (${song.key
      .replace(/b/g, "\u266d")
      .replace(/#/g, "\u266f")})</h3><h5>${song.composer}</h5>`;
    r.render(song, container, options);
    measures = findMeasures(container);

    // Add click handlers after rendering
    addMeasureClickHandlers();
  }

  function renderSelected() {
    var selected = document.getElementById("songs").options;
    selected = [...selected]
      .filter((option) => option.selected)
      .map((el) => +el.value);
    for (var i = 0; i < playlist.songs.length; i++) {
      if (selected.includes(i)) renderSong(i);
      else document.getElementById(`song-${i}`).innerHTML = "";
    }
  }

  /**
   * Find and count measures in a container
   * @param {Element} container - The container element
   * @returns {Array} Array of measure elements
   */
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

  /**
   * Add click handlers to measures
   * @param {Element} container - The container element
   */
  function addMeasureClickHandlers() {
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

          // Update bar number input
          document.getElementById('ui-barnumber').value = index;
        });
      });
    });
  }

  document
    .getElementById("songs")
    .addEventListener("change", () => renderSelected());

  document.querySelectorAll('[name="minor"]').forEach((el) => {
    el.addEventListener("click", (ev) => {
      var mode = ev.target.id;
      options.minor = mode;
      renderSelected();
    });
  });

  document.getElementById("ui-useh").addEventListener("click", (ev) => {
    options.useH = ev.target.checked;
    renderSelected();
  });

  document.getElementById("ui-hilite").addEventListener("click", (ev) => {
    options.hilite = ev.target.checked;
    renderSelected();
  });

  // Add handler for bar number input
  document.getElementById("ui-barnumber").addEventListener("change", ev => {
    const barNumber = parseInt(ev.target.value);
    if (isNaN(barNumber)) return;

    if (barNumber >= 0 && barNumber < measures.length) {
      // Simulate click on the first cell of the target measure
      measures[barNumber][0].click();
    }
  });

  // Hook into audio playing event
  getReactProps(LS_EL).children[1].props.item._ws.on('playing', (currentTime) => {
    const region = regions.find(r => r.start <= currentTime && r.end >= currentTime);
    if (region) {
      const barNumber = region.labels[0];
      if (barNumber == 'intro' || barNumber == 'outro') {
      } else if (barNumber) {
        measures[parseInt(barNumber)][0].click();
      }
    }
  });

  document.getElementById("ui-transpose").addEventListener("input", (ev) => {
    options.transpose = +ev.target.value;
    renderSelected();
  });
  document.getElementById("ui-transpose").addEventListener("change", (ev) => {
    options.transpose = +ev.target.value;
    renderSelected();
  });

  document.getElementById("ui-fontsize").addEventListener("input", (ev) => {
    document.getElementById("chords").style.fontSize = ev.target.value + "pt";
  });
  document.getElementById("ui-fontsize").addEventListener("change", (ev) => {
    document.getElementById("chords").style.fontSize = ev.target.value + "pt";
  });

  document.getElementById("ui-file").addEventListener("change", (ev) => {
    var f = ev.target.files[0];
    var reader = new FileReader();
    reader.addEventListener("loadend", () => {
      if (reader.error) alert(`Cannot read file ${f.name}: ${reader.error}`);
      else makePlaylist(reader.result);
    });
    reader.readAsText(f, "utf-8");
  });

  // Did the import of our DemoPlaylist.html file work?
  var el = document.querySelectorAll('link[rel="ireal-playlist"]');
  let playlistSource = 'DemoPlaylist.html';
  if (el.length) {
    playlistSource = el[0].href;
  }
  let response = await fetch(playlistSource);
  if (response.ok) {
    makePlaylist(await response.text());
    if (selected !== undefined) {
      renderSong(selected);
    }
  }
};

if (document.readyState === "complete") {
  onLoad();
} else {
  // Wait for the parent page react component to initialize
  // TODO: replace with throttling to check for the component property
  // we need this getReactProps(LS_EL).children[1].props.item._ws.regions.regions
  window.addEventListener("load", () => {
    window.setTimeout(() => {
      onLoad()
    }, 2000);
  });
}
