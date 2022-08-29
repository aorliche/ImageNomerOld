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
	box = new BoxPlot(bar);
    sideCommunities = new CommunitiesBarGraph(bar, $('#communities-div'));
    sideConnections = new ConnectionsBarGraph(bar, $('#connections-div'));

    // Load data
    let numLoaded = 0;

	function dataLoadCb(run) {
        // Run with labels goes at the front
        if (run.Labels) bar.runs.splice(0,0,run);
        else bar.runs.push(run);
        // Don't kill the page
        if (numLoaded == runCheckboxes.length) {
            bar.recalc();
            //box.recalc();
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
        const aid = $('.h-id').id;
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
    // Keep trying every 2 seconds
	function metadataLoadCb(meta) {
		if (meta) {
            bar.meta = meta;
            getActiveSideGraph().repaint();
		}
	}

    function loadMetadata() {
        if (!bar.meta) {
            const aid = $('.h-id').id;
            fetch(`/data?id=${aid}&metadata`)
            .then(resp => resp.json())
            .then(json => metadataLoadCb(json))
            .catch(err => console.log(err));
            setTimeout(loadMetadata, 2000);
        }
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

    // Selecting features on the main graph
    /*['mousemove', 'mouseout', 'click'].forEach(evtType => {
        $('#mainCanvas').addEventListener(evtType, e => {
		    const graph = getActiveMainGraph();
            graph[evtType](getCursorPosition($('#mainCanvas'), e));
		    graph.repaint();
        });
    });*/

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

    // Graph rect click (feature select)
    window.addEventListener('hashchange', e => {
        const [a,b,idx] = window.location.hash.substr(1).split('-');
        if (a == 'rect' && b == 'select' && idx) {
            bar.toggle(idx);
            bar.repaint();
        }
    });

    // Side graph select
    $('#side-graph-select').addEventListener('change', e => {
        $$('.side').forEach(side => {
            side.style.display = 'none';
        });
        const active = getActiveSideGraph();
        if (active instanceof VegaBarAdapter) {
            active.div.style.display = 'block';
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

	//const baselineCounts = [30,5,14,13,58,5,31,25,18,13,9,11,4,28].map(a => a/264);

    // Plot image
	function onlyUnique(value, index, self) {
	  return self.indexOf(value) === index;
	}

	function getSelectedConnections(type) {
        // Check that we have 'xxx-xxx' ROI information
        const labelsIdx = getRoiRoiLabelsIdx(bar);
        if (!labelsIdx || labelsIdx == 0) {
            alert('No labels in dataset');
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
        const aid = $('.h-id').id;
        const res = getSelectedConnections(consOrRegs);
        if ((res.connections && res.connections.length == 0) || 
            (res.regions && res.regions.length == 0)) {
            alert('No connections selected');
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
