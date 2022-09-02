function getCursorPosition(canvas, e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return {x: x, y: y};
}

var bar = null;
var box = null;
var sideCommunities = null;
var sideConnections = null;

var $ = q => document.querySelector(q);
var $$ = q => [...document.querySelectorAll(q)];

window.addEventListener('load', e => {
	const runCheckboxes = $$('#runs-list input[type=checkbox]');

	bar = new BarGraph($('#main'));
	box = new BoxPlot($('#main'), bar);
    sideCommunities = new CommunitiesBarGraph(bar, $('#communities-div'));
    sideConnections = new ConnectionsBarGraph(bar, $('#connections-div'));
    sideSimilarityMatrix = new SimilarityMatrix(bar, $('#similarity-run-div'));
    sideSimilarityLine = new SimilarityLineGraph(bar, $('#similarity-run-div'));

    // Load data
    let numLoaded = 0;

	function dataLoadCb(run) {
        // Run with labels goes at the front
        if (run.Labels) bar.runs.splice(0,0,run);
        else bar.runs.push(run);
        // Don't kill the page
        if (numLoaded == runCheckboxes.length) {
            bar.recalc();
            // If we have Labels, show the first one
            const select = $('#label-select');
            if (select.options.length > 1) {
                select.options.selectedIndex = 1;
                bar.labelsIdx = 0;
            }
            // Display
            getActiveMainGraph().repaint();
            getActiveSideGraph().repaint();
        }
        // Update checkbox
		runCheckboxes.forEach(box => {
			if (box.id == `run${run.runid}`) {
				box.parentNode.querySelector('.loading').innerText = 'Complete!';
			}
		});
	}

	runCheckboxes.forEach(box => {
        const aid = $('#description').dataset.id;
		const runid = parseInt(box.id.substring(3));
		// Get weights data
		fetch(`/data?id=${aid}&runid=${runid}`)
		.then(resp => resp.json())
		.then(json => {
            numLoaded++;
            dataLoadCb(json);
        })
		.catch(err => {
            numLoaded++;
            console.log(err);
        });
	});

    // Load metadata
    // Try once, then wait for user to click link
    // Old behavior was to keep trying every 5 seconds
    // Replace matching templates
	function metadataLoadCb(meta) {
        let found = false;
        for (let i=0; i<bar.meta.length; i++) {
            if (bar.meta[i].Template == meta.Template) {
                bar.meta[i] = meta;
                found = true;
            }
        }
        if (!found) bar.meta.push(meta);
        if (getActiveSideGraph() == sideCommunities)
            sideCommunities.repaint();
	}

    // We filter old metadata by template
    function loadMetadata() {
        const aid = $('#description').dataset.id;
        fetch(`/data?id=${aid}&metadata`)
        .then(resp => resp.json())
        .then(json => metadataLoadCb(json))
        .catch(err => console.log(err));
    }

    loadMetadata();

    // Placeholder div and nilearn-plot-div get a repaint method
    $('#placeholder-div').repaint = () => null;
    $('#nilearn-plot-div').repaint = () => null;

    function getActiveMainGraph() {
        const idx = $('#graph-select').selectedIndex;
		return idx == 0 ? bar : box;
    }

    function getActiveSideGraph() {
        const idx = $('#side-graph-select').selectedIndex;
        switch (idx) {
            case 0: return $('#placeholder-div');
            case 1: return sideCommunities;
            case 2: return sideConnections;
            case 3: return $('#nilearn-plot-div');
            case 4: return $('#nilearn-plot-div');
        }
    }

    // Main graph select
    $('#graph-select').addEventListener('change', e => {
        getActiveMainGraph().recalc();
        getActiveMainGraph().repaint();
    });

    // Label select
    $('#label-select').addEventListener('change', e => {
        const idx = $('#label-select').selectedIndex;
        bar.labelsIdx = idx == 0 ? null : idx-1;
        getActiveMainGraph().recalc();
        getActiveMainGraph().repaint();
    });

    // Events from graphs and links based on anchor hash change
    window.addEventListener('hashchange', e => {
        const parts = window.location.hash.substr(1).split('-');
        // Graph rect click (feature select)
        if (parts[0] == 'rect' && parts[1] == 'select') {
            getActiveMainGraph().toggle(parts[2]);
            getActiveMainGraph().repaint();
        // View similarity matrix for one of the runs
        } else if (parts[0] == 'view' && parts[1] == 'similarity' && parts[2] == 'run' && parts.length == 4) {
            // Update display
            $$('.side-opt').forEach(side => {
                side.style.display = 'none';
            });
            $('#similarity-run-div').style.display = 'block';
            $('#group-select-div').style.display = 'inline-block';
            $('#similarity-from-to-div').style.display = 'inline-block';
            const runidx = parseInt(parts[3]);
            sideSimilarityMatrix.repaint(runidx);
            // Remove previous groups selector
            $('#group-select-div').innerHTML = '';
            // Add new groups
            if (bar.runs[runidx].sim && bar.runs[runidx].sim.Groups) {
                // Add groups selector
                const groups = bar.runs[runidx].sim.Groups;
                const select = document.createElement('select');
                let opt = document.createElement('option');
                let count = 1;
                opt.innerText = 'None';
                select.appendChild(opt);
                for (const name in groups) {
                    opt = document.createElement('option');
                    opt.innerText = name;
                    select.appendChild(opt);
                    // Previously selected group
                    if (name == bar.groupSelect) {
                        select.selectedIndex = count++;
                    }
                };
                // Repaint the particular group
                select.addEventListener('change', e => {
                    bar.groupSelect = select.options[select.selectedIndex].text;
                    sideSimilarityMatrix.repaint(runidx);
                });
                // Add to UI
                const text = document.createTextNode('Group:');
                const div = $('#group-select-div');
                div.innerHTML = '';
                div.appendChild(text);
                div.appendChild(select);
            }
        // View similarity line graph for one subject in one run
        } else if (parts[0] == 'view' && parts[1] == 'similarity' && parts[2] == 'run' && parts[3] == 'from' && parts[4] == 'to' && parts.length > 6) {
            // Update display
            $$('.side-opt').forEach(side => {
                side.style.display = 'none';
            });
            $('#similarity-run-div').style.display = 'block';
            $('#subject-similarity-menu-div').style.display = 'block';
            // Parse args
            const runidx = parseInt(parts[5]);
            const from = parseInt(parts[6]);
            const to = parseInt(parts[7]);
            // Get the from or to choice
            // May be specified in hash
            const select = $('#similarity-from-to-div select');
            if (parts[8] == 'from') {
                select.selectedIndex = 0;
            } else if (parts[8] == 'to') {
                select.selectedIndex = 1;
            }
            const fromTo = select.selectedIndex == 0 ? {from: from} : {to: to};
            // Fill in return menu
            $('#subject-similarity-back-a').href = `#view-similarity-run-${runidx}`;
            $('#subject-similarity-from-a').href = `#view-similarity-run-from-to-${runidx}-${from}-${to}-from`;
            $('#subject-similarity-to-a').href = `#view-similarity-run-from-to-${runidx}-${from}-${to}-to`;
            sideSimilarityLine.repaint(runidx, fromTo);
        }
    });

    // Side graph select
    $('#side-graph-select').addEventListener('change', e => {
        // Update display
        $$('.side-opt').forEach(side => {
            side.style.display = 'none';
        });
        const active = getActiveSideGraph();
        if (active instanceof VegaDivAdapter) {
            // Communities and connections
            active.div.style.display = 'block';
            $('#from-to-div').style.display = 'inline-block';
        } else {
            active.style.display = 'block';
            // Plot image
            if (e.target.selectedIndex == 3) {
                consOrRegsRequest('regions');
            } else if (e.target.selectedIndex == 4) {
                consOrRegsRequest('connections');
            }
        }
        active.repaint();
    });

	function rangeChange() {
		const from = parseInt($('#from-range').value);
		const to = parseInt($('#to-range').value);
		$('#from-span').innerText = from;
		$('#to-span').innerText = to;
        [sideCommunities, sideConnections].forEach(side => {
            side.from = from;
            side.to = to;
            if (side == getActiveSideGraph()) {
                side.repaint();
            }
        });
	}

	$('#from-range').addEventListener('input', e => rangeChange());
	$('#to-range').addEventListener('input', e => rangeChange());

    // Set initial ranges
    $('#from-range').dispatchEvent(new Event('input'));
    $('#to-range').dispatchEvent(new Event('input'));

    // Plot image
	function onlyUnique(value, index, self) {
	  return self.indexOf(value) === index;
	}

	function getSelectedConnections(type) {
        // Check that we have 'xxx-xxx' ROI information
        const labelsIdx = getRoiRoiLabelsIdx(bar);
        if (!labelsIdx || labelsIdx == 0) {
            $('#nilearn-plot-div').innerText = 'No labels in dataset';
            return;
        }
        const graph = getActiveMainGraph();
        // Get 'xxx-xxx'
        const labels = graph.selected.map(idx => bar.runs[0].Labels[labelsIdx][idx]);
        // Convert to ROI pairs
        const cons = labels.map(label => label.split('-').map(roi => parseInt(roi)));
        console.log(cons);
		if (type == 'regions') {
			const regs = cons.flat().filter(onlyUnique);
			return {regions: regs};
		} else {
			return {connections: cons};
		}
	}

	function displayImage(json) {
        if (json.error) {
            console.log(json.error);
            return;
        }
        const img = new Image();
        img.src = 'data:image/png;base64,' + json.b64;
        img.alt = 'nilearn plot';
        $('#nilearn-plot-div').innerHTML = '';
        $('#nilearn-plot-div').appendChild(img);
	}
		
	//headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
	headers = {"Content-Type": "application/json"}

    function consOrRegsRequest(consOrRegs) {
        const aid = $('#description').dataset.id;
        const res = getSelectedConnections(consOrRegs);
        if ((res.connections && res.connections.length == 0) || 
            (res.regions && res.regions.length == 0)) {
            $('#nilearn-plot-div').innerText = 'No connections selected';
            return;
        }
        e.preventDefault();
        fetch(`/data?id=${aid}&image=${consOrRegs}`, {
            method: 'POST', 
            headers: headers, 
			body: JSON.stringify(res)
        })
		.then(resp => resp.json())
		.then(json => displayImage(json))
		.catch(err => console.log(err));
    }

   /* 
	plotRegionsButton.addEventListener('click', e => consOrRegsRequest('regions'));
	plotConnectionsButton.addEventListener('click', e => consOrRegsRequest('connections'));*/

    // Export labels from the main graph
    function exportLabels() {
        const text = [];
        /*if (barBoxButton.innerText == 'Box Plot') {
            barGraph.bars.forEach(bar => {
                text.push(bar.label);
            });
        } else {
            boxPlot.boxes.forEach(box => {
                text.push(box.label);
            });
        }*/
        const items = getActiveMainGraph() == bar ? bar.bars : box.boxes;
        items.forEach(item => {
            text.push(item.label);
        });
        const file = new Blob([text.join('\n')], {type: "application/octet-stream"});
        const a = document.createElement("a");
        const url = URL.createObjectURL(file);
        a.href = url;
        a.download = "labels.txt";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    $('#export-labels-a').addEventListener('click', e => {
        e.preventDefault();
        exportLabels();
    });
    
    /*exportLabelsA.addEventListener('click', e => {
        e.preventDefault();
        exportLabels();
    });

    loadMetadataA.addEventListener('click', e => {
        e.preventDefault();
        loadMetadata();
    });*/
});
