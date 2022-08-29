function zip(a, b) {
	return a.map((e,i) => [e, b[i]]);
}

function range(end) {
    return [...Array(end).keys()];
}

// Label index of bar graph in form 'xxx-xxx'
// The labeled (Labels, LabelNames) run is always at position 0, all other runs are unlabeled
function getRoiRoiLabelsIdx(graph) {
    let labelsIdx = null;
    graph.runs[0].Labels.forEach((labels, i) => {
        if (labels[0].toString().search(/\d+-\d+/) != -1) {
            labelsIdx = i;
        }
    });
    return labelsIdx;
}

/*function strokeLine(ctx, p0, p1, color) {
	ctx.strokeStyle = color ?? '#000';
	ctx.beginPath();
	ctx.moveTo(p0.x, p0.y);
	ctx.lineTo(p1.x, p1.y);
	ctx.stroke();
}*/

class VegaBarAdapter {
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

/*class Bar extends VegaBarAdapter {
	constructor(params) {
		this.idx = params.idx;
		this.graph = params.graph;
		this.pos = params.pos;
		this.dim = params.dim;
		this.color = params.color ?? '#204e8a';
		this.hoverColor = params.hoverColor ?? '#630094';
		this.display = params.display ?? true;
	}

	contains(p) {
		return p.x > this.pos.x && p.x < this.pos.x+this.dim.w &&
			p.y > this.pos.y && p.y < this.pos.y+this.dim.h;
	}

	draw(ctx, n) {
		n = n ?? 0;
		ctx.fillStyle = (this.hovering || this.selected) ? this.hoverColor : this.color;
		ctx.fillRect(this.pos.x, this.pos.y, this.dim.w, this.dim.h);
		if (this.hovering || this.selected || this.display) {
			const y = (n%2 == 0) ? this.pos.y-12 : this.pos.y+this.dim.h+12;
			ctx.fillStyle = '#000';
			ctx.font = 'normal 8px Sans-serif';
			//const label = this.graph.displayMeta.checked && this.graph.meta ? this.metaLabel : this.label;
            if (this.graph.labelsIdx || this.graph.labelsIdx === 0) {
                const label = this.graph.runs[0].Labels[this.graph.labelsIdx][this.idx];
                const labelWidth = ctx.measureText(label).width;
                ctx.fillText(label, this.pos.x-labelWidth/2+this.dim.w/2, y);
            }
		}
	}

	get metaLabel() {
		let [a,b] = this.label.split('-');
		a = this.graph.meta.CommunityNames[this.graph.meta.CommunityMap[parseInt(a)]];
		b = this.graph.meta.CommunityNames[this.graph.meta.CommunityMap[parseInt(b)]];
		return `${a}-${b}`;
	}
}

class Box {
	constructor(params) {
		this.label = params.label;
		this.graph = params.graph;
		this.outerPos = params.outerPos;
		this.innerPos = params.innerPos;
		this.outerDim = params.outerDim; 
		this.innerDim = params.innerDim;
		this.median = params.median;
		this.outliers = params.outliers;
		this.color = params.color ?? '#204e8a';
		this.hoverColor = params.hoverColor ?? '#630094';
		this.display = params.display ?? true;
	}
	
	contains(p) {
		return p.x > this.innerPos.x && p.x < this.innerPos.x+this.innerDim.w &&
			p.y > this.innerPos.y && p.y < this.innerPos.y+this.innerDim.h;
	}
	
	draw(ctx, n) {
		ctx.fillStyle = (this.hovering || this.selected) ? this.hoverColor : this.color;
		ctx.fillRect(this.innerPos.x, this.innerPos.y, this.innerDim.w, this.innerDim.h);
		strokeLine(ctx, this.outerPos, {x: this.outerPos.x+this.outerDim.w, y: this.outerPos.y});
		strokeLine(
			ctx,
			{x: this.outerPos.x, y: this.outerPos.y+this.outerDim.h}, 
			{x: this.outerPos.x+this.outerDim.w, y: this.outerPos.y+this.outerDim.h}
		);
		strokeLine(
			ctx,
			{x: this.outerPos.x+0.5*this.outerDim.w, y: this.outerPos.y},
			{x: this.outerPos.x+0.5*this.outerDim.w, y: this.outerPos.y+this.outerDim.h}
		);
		if (this.hovering || this.selected || this.display) {
			const y = (n%2 == 0) ? this.innerPos.y-12 : this.innerPos.y+this.innerDim.h+12;
			ctx.fillStyle = '#000';
			ctx.font = 'normal 8px Sans-serif';
			const label = this.graph.displayMeta.checked && this.graph.meta ? this.metaLabel : this.label;
			const labelWidth = ctx.measureText(label).width;
			ctx.fillText(label, this.innerPos.x-labelWidth/2+this.innerDim.w/2, y);
		}
	}
	
	get metaLabel() {
		let [a,b] = this.label.split('-');
		a = this.graph.meta.CommunityNames[this.graph.meta.CommunityMap[parseInt(a)]];
		b = this.graph.meta.CommunityNames[this.graph.meta.CommunityMap[parseInt(b)]];
		return `${a}-${b}`;
	}
}*/

class ConnectionsBarGraph extends VegaBarAdapter {
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
            { "orient": "left", "scale": "yscale" }
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

class CommunitiesBarGraph extends VegaBarAdapter {
    constructor(bar, div) {
        super(div);
        this.bar = bar; // main bar graph
        this.bins = [];
    }

    repaint() {
        this.repaintEmpty('Not implemented');
    }
}

class BarGraph extends VegaBarAdapter {
	constructor(div) {
        super(div);
		this.runs = [];
		this.from = 0;
        this.to = 20;
		this.sorted = true;
		this.abs = true;
		this.composite = null;
        this.labelsIdx = null;
        this.selected = [];
	}

    get dim() {
        const style = getComputedStyle(this.div);
        return {w: parseInt(style.width), h: parseInt(style.height)};
    }

	recalc() {
		this.composite = new Array(this.runs[0].Weights.length).fill(0);
		this.runs.forEach(run => {
			for (let i=0; i<this.composite.length; i++) {
				this.composite[i] += run.Weights[i]/this.composite.length;
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
        // Can graph even before data finishes loading
        if (!this.composite || !this.runs[0].Labels) {
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
            /*"signals": [
            {
                "name": "tooltip",
                "value": {},
                "on": [
                    {"events": "rect:mousedown", "update": "datum"},
                ]
            }],*/
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
            { "orient": "left", "scale": "yscale" }
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
                        "fill": {"value": "#333"}
                    },
                    "update": {
                        "x": {"scale": "xscale", field: "idx", offset: 12},
                        "y": {"scale": "yscale", field: 'alt-weight', "offset": {data: 'weights', field: 'offset'}},
                        "text": {"data": "bins", "field": "label" },
                    }
                }
            }]
        };
        // Display in the div
        this.render(spec);
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

class BoxPlot {
	constructor(barGraph) {
		this.barGraph = barGraph;
		this.boxes = [];
	}
	
	click(p) {
		this.boxes.forEach(box => {
			if (box.contains(p)) box.selected = !box.selected;
		});
	}

	get dim() {
		return this.barGraph.dim;
	}

	set dim(dim) {
		this.barGraph.dim = dim;
	}

	/*set displayLabels(display) {
		this.display = display;
		this.boxes.forEach(box => box.display = display);
	}*/
	
	mousemove(p) {
		this.mouseout();
		this.boxes.forEach(bar => {
			if (bar.contains(p)) bar.hovering = true;	
		});
	}

	mouseout() {
		this.boxes.forEach(bar => bar.hovering = false);
	}

	recalc() {
		this.stats = new Array(this.runs[0].Weights.length);
		const m = this.runs.length;
		for (let i=0; i<this.stats.length; i++) {
			const dist = this.runs.map(run => run.Weights[i]);
			dist.sort((a,b) => a-b);
			// minimum, maximum, median, 1st quartile, 3rd quartile, outliers
			const stats = [
				dist[0], 
				dist.at(-1), 
				(m%2 == 0) ? (dist[m/2]+dist[m/2-1])/2 : dist[Math.floor(m/2)], 
				dist[Math.floor(m/4)],
				dist[Math.floor(3*m/4)]
			];
			stats.push(dist.filter(val => (val-stats[2])>1.5*(val-stats[3]) || (val-stats[2])>1.5*(val-stats[4])));
			this.stats[i] = stats;
		}
		this.stats = zip(this.stats, this.runs[0].Labels[this.barGraph.labelsIdx]);
		if (this.barGraph.sorted) {
			this.stats.sort((a,b) => Math.abs(b[0][2])-Math.abs(a[0][2]));
		}
		this.min = Math.min(...this.stats.filter(dist => dist[0][0]).map(a => a[0][0]));
		this.max = Math.max(...this.stats.filter(dist => dist[0][1]).map(a => a[0][1]));
		this.boxes = [];
		this.dim = this.barGraph.dim;
		// Make boxes
		const n = this.view[1]-this.view[0];
		console.assert(n > 0 && n < 1e5);
		const dx = (this.dim.w-50)/n
		const bx = 0.6*dx;
		const uh = this.dim.h-50;
		const zy = this.max/(this.max+Math.abs(this.min))*uh+25;
		const dy = uh/(this.max-this.min);
		for (let i=0, j=this.view[0], x=0; i<n; i++, j++, x+=dx) {
			const y0 = zy-dy*this.stats[j][0][0]; // min
			const y1 = zy-dy*this.stats[j][0][1]; // max
			const y2 = zy-dy*this.stats[j][0][2]; // median
			const y3 = zy-dy*this.stats[j][0][3]; // 1st quart
			const y4 = zy-dy*this.stats[j][0][4]; // 3rd quart
			const x = i*dx+25;
			this.boxes.push(new Box({
				label: this.stats[j][1],
				graph: this,
				outerPos: {x: x+0.25*bx, y: y1},
				innerPos: {x: x, y: y4},
				outerDim: {w: 0.5*bx, h: y0-y1},
				innerDim: {w: bx, h: y3-y4},
				median: {x: x, y: y2},
				outliers: this.stats[j][0][5].map(val => ({x: x+0.5*bx, y: zy-dy*val})),
				display: this.display
			}));
		}
		this.zy = zy;
	}

	get runs() {
		return this.barGraph.runs;
	}

	set runs(runs) {
		this.barGraph.runs = runs;
	}

	repaint(ctx) {
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, this.dim.w, this.dim.h);
		strokeLine(ctx, {x: 20, y: this.zy}, {x: this.dim.w-20, y: this.zy});
		let count = 0;
		this.boxes.forEach(box => box.draw(ctx, count++));
		const ny = 6;
		const dy = (this.dim.h-50)/ny;
		const dyy = (this.max-this.min)/ny;
		for (let i=0; i<=ny+.1; i++) {
			const x = 2;
			const y = 25+i*dy;
			ctx.fillStyle = '#000';
			ctx.font = '8px Sans-serif';
			ctx.fillText((this.max-i*dyy).toFixed(3), x, y);
		}
	}

	get view() {
		return this.barGraph.view;
	}

	set view(view) {
		this.barGraph.view = view;
	}
}
