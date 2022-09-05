function zip(a, b) {
	return a.map((e,i) => [e, b[i]]);
}

function range(end) {
    return [...Array(end).keys()];
}

function sum(arr) {
    let s = 0;
    arr.forEach(elt => s += elt);
    return s;
}

// Label index of bar graph in form 'xxx-xxx'
// The labeled (Labels, LabelNames) run is always at position 0, all other runs are unlabeled
function getRoiRoiLabelsIdx(graph) {
    let labelsIdx = null;
    graph.runs[0].Labels.forEach((labels, i) => {
        if (labels[0].toString().search(/^\d+-\d+$/) != -1) {
            labelsIdx = i;
        }
    });
    return labelsIdx;
}

class VegaDivAdapter {
    constructor(div) {
        this.div = div;
        this.view = null;
    }

    render(spec) {
        this.view = new vega.View(vega.parse(spec), {
            renderer: 'canvas',
            container: `#${this.div.id}`,
            hover: true
        });
        return this.view.runAsync();
    }

    repaintEmpty(msg) {
        // Clear graph
        this.div.innerHTML = '';
        this.div.innerText = msg;
        // Remove listeners
        const div = this.div.cloneNode(true);
        this.div.parentNode.replaceChild(div, this.div);
        this.div = div;
        this.div.classList.add('empty');
    }
}

class ConnectionsBarGraph extends VegaDivAdapter {
    constructor(bar, div) {
        super(div);
        this.bar = bar; // main bar graph
    }

    repaint() {
        // We've loaded data
        if (this.bar.runs.length == 0) {
            this.repaintEmpty('No runs loaded');
            return;
        }
        this.bins = [];
        // Check that bar contains connections (labels) of the form 'xxx-xxx'
        const labelsIdx = getRoiRoiLabelsIdx(this.bar);
        if (!labelsIdx && labelsIdx !== 0) {
            this.repaintEmpty('No labels matching "xxx-xxx" in run 0');
            return;
        }
        // Bin connections in range From - To (set via listener in analyze.js)
        for (let i=this.from; i<this.to; i++) {
            this.bar.runs[0].Labels[labelsIdx][this.bar.composite[i][1]].split('-').forEach(roi => {
                const prev = this.bins[roi] ?? 0;
                this.bins[roi] = prev+1;
            });
        }
        // Fill in empty slots
        for (let i=0; i<this.bins.length; i++) {
            if (!this.bins[i]) this.bins[i] = 0;
        }
        // Get top 6 rois
        const sortedBins = this.bins.map((n, roi) => [n, roi]);
        sortedBins.sort((a,b) => b[0]-a[0]);
        const top6 = sortedBins.slice(0,6).map(a => a[1]);
        // Construct Vega spec
        const style = getComputedStyle(this.div);
        const values = this.bins.map((n, roi) => ({"roi": roi.toString(), "top6roi": top6.includes(roi) ? roi.toString() : "", "number": n}));
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": parseInt(style.width)-60,
            "height": parseInt(style.height)-60,
            "padding": 0,
            "data": [
            {
                "name": "bins",
                "values": values
            }],
            "signals": [
            {
                "name": "tooltip",
                "value": {},
                "on": [
                    {"events": "rect:mouseover", "update": "datum"},
                    {"events": "rect:mouseout", "update": "{}"},
                ]
            }],
            "scales": [
            {
                "name": "xscale",
                "type": "band",
                "domain": {"data": "bins", "field": "roi"},
                "range": "width",
                "padding": 0.1,
                "round": true
            },
            {
                "name": "yscale",
                "domain": {"data": "bins", "field": "number"},
                "nice": true,
                "range": "height"
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", "labels": false},
            { "orient": "left", "scale": "yscale", grid: true }
            ],
            "marks": [
            {
                "type": "rect",
                "from": {"data": "bins"},
                "encode": {
                    "enter": {
                        "x": {"scale": "xscale", "field": "roi"},
                        "width": {"scale": "xscale", "band": 1},
                        "y": {"scale": "yscale", "field": "number"},
                        "y2": {"scale": "yscale", "value": 0}
                    },
                    "update": {
                        "fill": {"value": "steelblue"}
                    },
                    "hover": {
                        "fill": {"value": "red"}
                    }
                }
            },
            { // Always display top 6
                "type": "text",
                "from": {"data": "bins"},
                "encode": {
                    "enter": {
                        "align": {"value": "center"},
                        "baseline": {"value": "bottom"},
                        "fill": {"value": "#333"}
                    },
                    "update": {
                        "x": {"scale": "xscale", field: "roi"},
                        "y": {"scale": "yscale", field: 'number', "offset": -2},
                        "text": {"data": "bins", "field": "top6roi" },
                        "fill": {"value": "#333"}
                    }
                }
            },
            { // Show others on mouseover
                "type": "text",
                "encode": {
                    "enter": {
                        "align": {"value": "center"},
                        "baseline": {"value": "bottom"},
                        "fill": {"value": "#333"}
                    },
                    "update": {
                        "x": {"scale": "xscale", "signal": "tooltip.roi"},
                        "y": {"scale": "yscale", "signal": "tooltip.number", "offset": -2},
                        "text": {"signal": "tooltip.roi"},
                        "fillOpacity": [
                            {"test": "isNaN(tooltip.roi)", "value": 1},
                            {"value": 1}
                        ]
                    }
                }
            }]
        };
        // Display in the div
        this.render(spec);
    }
}

class CommunitiesBarGraph extends VegaDivAdapter {
    constructor(bar, div) {
        super(div);
        this.bar = bar; // main bar graph
        this.bins = [];
    }

    repaint() {
        // We've loaded data
        if (this.bar.runs.length == 0) {
            this.repaintEmpty('No runs loaded');
            return;
        }
        this.bins = [];
        // Check that bar contains connections (labels) of the form 'xxx-xxx'
        const labelsIdx = getRoiRoiLabelsIdx(this.bar);
        if (!labelsIdx && labelsIdx !== 0) {
            this.repaintEmpty('No labels matching "xxx-xxx" in run 0');
            return;
        }
        // Check that the 'xxx-xxx' labels match a loaded template
        // 1: full match, +2: the 2 rois = 3
        const meta = bar.meta.filter(m => bar.runs[0].Labels[labelsIdx][0].match(new RegExp(m.Template)).length == 3)[0];
        if (!meta) {
            this.repaintEmpty('No matching community metadata loaded');
            return;
        }
        // Bin connections in range From - To (set via listener in analyze.js)
        this.bins = new Array(meta.CommunityNames.length).fill(0);
        for (let i=this.from; i<this.to; i++) {
            this.bar.runs[0].Labels[labelsIdx][this.bar.composite[i][1]].split('-').forEach(roi => {
                this.bins[meta.CommunityMap[parseInt(roi)]]++;
            });
        }
        // Normalize expected to bins
        const binA = sum(this.bins);
        const expA = sum(meta.Expected);
        this.exp = meta.Expected.map(n => n*binA/expA);
        // Construct Vega spec
        const style = getComputedStyle(this.div);
        const values = this.bins.map((n, comm) => ({community: meta.CommunityNames[comm], 
            number: n, expected: this.exp[comm], max: Math.max(n, this.exp[comm])}));
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": parseInt(style.width)-60,
            "height": parseInt(style.height)-60,
            "padding": 0,
            "data": [
            {
                "name": "bins",
                "values": values
            }],
            "signals": [
            {
                "name": "tooltip",
                "value": {},
                "on": [
                    {"events": "rect:mouseover", "update": "datum"},
                    {"events": "rect:mouseout", "update": "{}"},
                ]
            }],
            "scales": [
            {
                "name": "xscale",
                "type": "band",
                "domain": {"data": "bins", "field": "community"},
                "range": "width",
                "padding": 0.1,
                "round": true
            },
            {
                "name": "yscale",
                "domain": {"data": "bins", "field": "max"},
                "nice": true,
                "range": "height"
            },
            {
                name: 'yscaleNumber',
                domain: {data: 'bins', field: 'number'},
                nice: true,
                range: 'height'
            },
            {
                name: 'yscaleExpected',
                domain: {data: 'bins', field: 'expected'},
                nice: true,
                range: 'height'
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", "labels": false},
            { "orient": "left", "scale": "yscale", grid: true }
            ],
            "marks": [ // rectangle for number
            {
                "type": "rect",
                "from": {"data": "bins"},
                "encode": {
                    "enter": {
                        "x": {"scale": "xscale", "field": "community"},
                        "width": {"scale": "xscale", "band": 1},
                        "y": {"scale": "yscale", "field": "number"},
                        "y2": {"scale": "yscale", "value": 0}
                    },
                    "update": {
                        "fill": {"value": "steelblue"}
                    },
                    /*"hover": {
                        "fill": {"value": "red"}
                    }*/
                }
            },
            { // red line for expected
                type: 'rect',
                from: {data: 'bins'},
                encode: {
                    enter: {
                        x: {scale: 'xscale', field: 'community'},
                        width: {scale: 'xscale', band: 1},
                        y: {scale: 'yscale', field: 'expected'},
                        y2: {scale: 'yscale', field: 'expected', offset: -2},
                        fill: {value: 'red'}
                    }
                }
            },
            { // Display short community name above max
                "type": "text",
                "from": {"data": "bins"},
                "encode": {
                    "enter": {
                        "align": {"value": "left"},
                        "baseline": {"value": "bottom"},
                        "x": {"scale": "xscale", field: "community"},
                        "y": {"scale": "yscale", field: 'max', "offset": -2},
                        "text": {"data": "bins", "field": "community" },
                        "fill": {"value": "#333"}
                    },
                }
            }]
        };
        // Display in the div
        this.render(spec);
    }
}

class MainGraph extends VegaDivAdapter {
	constructor(div) {
        super(div);
        this.selected = [];
    }

    toggle(idx) {
        idx = parseInt(idx);
        const i = this.selected.indexOf(idx);
        if (i != -1) {
            this.selected.splice(i, 1);
        } else {
            this.selected.push(idx);
        }
    }
}

class BarGraph extends MainGraph {
	constructor(div) {
        super(div);
		this.runs = [];
		this.from = 0;
        this.to = 20;
		this.sorted = true;
		this.abs = true;
		this.composite = null;
        this.labelsIdx = null;
        this.meta = [];
	}

    get dim() {
        const style = getComputedStyle(this.div);
        return {w: parseInt(style.width), h: parseInt(style.height)};
    }

	recalc() {
		this.composite = new Array(this.runs[0].Weights.length).fill(0);
		this.runs.forEach(run => {
			for (let i=0; i<this.composite.length; i++) {
				this.composite[i] += run.Weights[i]/this.runs.length;
			}
		});
		if (this.abs) {
			this.composite = this.composite.map(a => Math.abs(a));
		}
		this.min = Math.min(...this.composite);
		this.max = Math.max(...this.composite);
        // Indices for accessing labels
		this.composite = this.composite.map((w, i) => [w,i]);
		if (this.sorted) {
			this.composite.sort((a,b) => b[0]-a[0]);
		}
	}

	repaint() {
        // Can't graph before some data loads
        if (!this.composite) {
            this.repaintEmpty('Data not loaded yet...');
            return;
        }
        // Get data to be graphed
        const values = [];
        this.values = values;
        for (let i=this.from; i<this.to; i++) {
            const [w,idx] = this.composite[i];
            let altW, offset;
            if ((i-this.from)%2 == 0) {
                altW = w;
                offset = 0;
            } else {
                altW = 0;
                offset = 16;
            }
            values.push({
                idx: idx.toString(), 
                weight: w, 
                'alt-weight': altW, 
                offset: offset, 
                label: '', 
                link: `#rect-select-${idx}`,
                selected: this.selected.includes(idx)
            });
            if (this.labelsIdx || this.labelsIdx === 0) {
                values.at(-1).label = this.runs[0].Labels[this.labelsIdx][idx];
            }
        }
        const style = getComputedStyle(this.div);
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": parseInt(style.width)-80,
            "height": parseInt(style.height)-60,
            "padding": 0,
            "data": [
            {
                "name": "weights",
                "values": values
            }],
            "scales": [
            {
                "name": "xscale",
                "type": "band",
                "domain": {"data": "weights", "field": "idx"},
                "range": "width",
                "padding": 0.1,
                "round": true
            },
            {
                "name": "yscale",
                "domain": {"data": "weights", "field": "weight"},
                "nice": true,
                "range": "height"
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", "labels": false},
            { "orient": "left", "scale": "yscale", grid: true }
            ],
            "marks": [
            {
                "type": "rect",
                "from": {"data": "weights"},
                "encode": {
                    "enter": {
                        "x": {"scale": "xscale", "field": "idx"},
                        "width": {"scale": "xscale", "band": 1},
                        "y": {"scale": "yscale", "field": "weight"},
                        "y2": {"scale": "yscale", "value": 0},
                        href: {data: 'weight', field: 'link'}
                    },
                    "update": {
                        fill: [
                            {test: 'datum.selected', value: 'red'},
                            {value: 'steelblue'}
                        ],
                    },
                    "hover": {
                        "fill": {"value": "red"},
                        'cursor': {'value': 'pointer'},
                    }
                }
            },
            { // Alternate display text above and below bar
                "type": "text",
                "from": {"data": "weights"},
                "encode": {
                    "enter": {
                        "align": {"value": "center"},
                        "baseline": {"value": "bottom"},
                        "x": {"scale": "xscale", field: "idx", offset: 12},
                        "y": {"scale": "yscale", field: 'alt-weight', "offset": {data: 'weights', field: 'offset'}},
                        "text": {"data": "bins", "field": "label" },
                        "fill": {"value": "#333"}
                    },
                }
            }]
        };
        // Display in the div
        this.render(spec);
	}
}

class BoxPlot extends MainGraph {
	constructor(div, bar) {
        super(div);
		this.bar = bar;
	}

	recalc() {
        // Get stats
		this.stats = new Array(this.bar.runs[0].Weights.length);
		const m = this.bar.runs.length;
		for (let i=0; i<this.stats.length; i++) {
			const dist = this.bar.runs.map(run => run.Weights[i]);
            //const mu = sum(dist)/dist.length;
			dist.sort((a,b) => a-b);
			// minimum, maximum, median, 1st quartile, 3rd quartile, index
			this.stats[i] = {
				min: dist[0], 
				max: dist.at(-1),
                //mu: mu,
				median: (m%2 == 0) ? (dist[m/2]+dist[m/2-1])/2 : dist[Math.floor(m/2)], 
				first: dist[Math.floor(m/4)],
				third: dist[Math.floor(3*m/4)],
                //std: (Math.sqrt(sum(dist.map(d => Math.pow(d,2))) - Math.pow(mu,2)))/(dist.length-1),
                tenth: dist[Math.floor(m/10)],
                ninetieth: dist[Math.floor(9*m/10)],
                idx: i,
                idxP1: i+1 // for makeshift zero line plotting
			};
		}
        // Sort by median
		if (this.bar.sorted) {
			this.stats.sort((a,b) => Math.abs(b.median)-Math.abs(a.median));
		}
    }

    repaint() {
        // Can graph even before data finishes loading
        if (!this.stats) {
            this.repaintEmpty('Data not loaded yet...');
            return;
        }
        // Get data to be graphed
        let domainMin = Infinity, domainMax = -Infinity;
        const values = [];
        for (let i=this.bar.from; i<this.bar.to; i++) {
            const stats = {...this.stats[i]};
            if ((i-this.from)%2 == 0) {
                stats.offset = this.stats[i][0];
            } else {
                stats.offset = this.stats[i][1];
            }
            stats.link = `#rect-select-${stats.idx}`;
            stats.selected = this.selected.includes(stats.idx);
            // Min and max get crazy sometimes
            // Replace with 10% and 90%
            stats.min = stats.tenth
            stats.max = stats.ninetieth
            values.push(stats);
            // Update domain
            if (stats.min < domainMin) domainMin = stats.min;
            if (stats.max > domainMax) domainMax = stats.max;
            // Place labels
            if (this.bar.labelsIdx || this.bar.labelsIdx === 0) {
                stats.label = this.bar.runs[0].Labels[this.bar.labelsIdx][stats.idx];
            } else {
                stats.label = '';
            }
            if (i%2 == 0) {
                // Above
                stats.textPosValue = stats.max;
                stats.offset = -2;
            } else {
                // Below
                stats.textPosValue = stats.min;
                stats.offset = 16;
            }
        }
        const style = getComputedStyle(this.div);
        // Adjust domains for text
        const width = parseInt(style.width)-80;
        const height = parseInt(style.height)-60;
        const dd = domainMax-domainMin;
        const hd = dd*40/height;
        domainMax += hd/2;
        domainMin -= hd/2;
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": width,
            "height": height,
            "padding": 0,
            "data": [
            {
                "name": "weights",
                "values": values,
            }],
            "scales": [
            {
                "name": "xscale",
                "type": "band",
                "domain": {"data": "weights", "field": "idx"},
                "range": "width",
                "padding": 0.1,
                "round": true
            },
            {
                "name": "yscale",
                domain: {data: 'weights', field: 'median'},
                domainMin: domainMin,
                domainMax: domainMax,
                "range": "height"
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", "labels": false},
            { "orient": "left", "scale": "yscale", grid: true }
            ],
            "marks": [
            { // Central line
                type: 'rect',
                from: {data: 'weights'},
                encode: {
                    enter: {
                        xc: {scale: 'xscale', field: 'idx', offset: 5},
                        width: {value: 1},
                        y: {scale: 'yscale', field: 'min'},
                        y2: {scale: 'yscale', field: 'max'},
                        fill: {value: 'black'}
                    }
                }
            },
            {
                "type": "rect",
                "from": {"data": "weights"},
                "encode": {
                    "enter": {
                        "xc": {"scale": "xscale", "field": "idx", offset: 5},
                        "width": {"scale": "xscale", "band": 1},
                        "y": {"scale": "yscale", "field": "first"},
                        "y2": {"scale": "yscale", field: 'third'},
                        href: {data: 'weight', field: 'link'}
                    },
                    "update": {
                        fill: [
                            {test: 'datum.selected', value: 'red'},
                            {value: 'steelblue'}
                        ],
                    },
                    "hover": {
                        "fill": {"value": "red"},
                        'cursor': {'value': 'pointer'},
                    }
                }
            },
            { // Minimum (10%)
                type: 'rect',
                from: {data: 'weights'},
                encode: {
                    enter: {
                        xc: {scale: 'xscale', field: 'idx', offset: 5},
                        width: {scale: 'xscale', band: 1},
                        y: {scale: 'yscale', field: 'min'},
                        y2: {scale: 'yscale', field: 'min', offset: -1},
                        fill: {value: 'black'}
                    }
                }
            },
            { // Maximum (90%)
                type: 'rect',
                from: {data: 'weights'},
                encode: {
                    enter: {
                        xc: {scale: 'xscale', field: 'idx', offset: 5},
                        width: {scale: 'xscale', band: 1},
                        y: {scale: 'yscale', field: 'max'},
                        y2: {scale: 'yscale', field: 'max', offset: 1},
                        fill: {value: 'black'}
                    }
                }
            },
            { // Median
                type: 'rect',
                from: {data: 'weights'},
                encode: {
                    enter: {
                        xc: {scale: 'xscale', field: 'idx', offset: 5},
                        width: {scale: 'xscale', band: 1},
                        y: {scale: 'yscale', field: 'median'},
                        y2: {scale: 'yscale', field: 'median', offset: 1},
                        fill: {value: '#afa'}
                    }
                }
            },
            { // Alternate display text above and below bar
                "type": "text",
                "from": {"data": "weights"},
                "encode": {
                    "enter": {
                        "align": {"value": "center"},
                        "baseline": {"value": "bottom"},
                        "fill": {"value": "#333"},
                        xc: {"scale": "xscale", field: "idx", offset: 5},
                        "y": {"scale": "yscale", field: 'textPosValue', "offset": {data: 'weights', field: 'offset'}},
                        "text": {"data": "bins", "field": "label" },
                    }
                }
            }]
        };
        // Display in the div
        this.render(spec);
	}
}
