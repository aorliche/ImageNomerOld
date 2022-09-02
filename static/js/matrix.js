
class SimilarityMatrix extends VegaDivAdapter {
    constructor(bar, div) {
        super(div);
        this.bar = bar;
    }

    repaint(runidx) {
        const run = this.bar.runs[runidx];
        const sim = run.sim;
        if (!sim) {
            this.repaintEmpty(`No similarity for run ${runidx}`);
            return;
        }
        // Currently only 1 edges
        const edges = sim.Edges;
        const from = sim.From;
        const to = sim.To;
        const fromIds = sim.FromIds ?? [];
        const toIds = sim.ToIds ?? [];
        const values = edges.map((e,i) => ({
            value: e,
            from: from[i].toString(),
            to: to[i].toString(),
            fromId: fromIds[from[i]],
            toId: toIds[to[i]],
            link: `#view-similarity-run-from-to-${runidx}-${from[i]}-${to[i]}`,
            tofrom: `To: ${to[i]} (Id: ${toIds[to[i]]}) From: ${from[i]} (Id: ${fromIds[from[i]]})`,
            groupOpacity: (
                bar.groupSelect == 'None'
                || !bar.groupSelect
                || sim.Groups[bar.groupSelect].includes(from[i]) 
                || sim.Groups[bar.groupSelect].includes(to[i]))  
                ? 0.8 : 1,
        }));
        const style = getComputedStyle(this.div);
        const width = parseInt(style.width)-80;
        const height = parseInt(style.height)-80;
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": width,
            "height": height,
            "padding": 0,
            title: `Run ${runidx} Accuracy: ${run.Accuracy} Train: ${run.Train} Test: ${run.Test}`,
            "data": [
            {
                name: 'edges',
                values: values,
            }],
            "signals": [
            {
                "name": "hover",
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
                "domain": {"data": "edges", "field": "from"},
                "range": "width",
                nice: true,
                "padding": 0,
            },
            {
                "name": "yscale",
                type: 'band',
                domain: {data: 'edges', field: 'to'},
                "range": "height",
                nice: true,
                padding: 0,
            },
            {
                name: 'color',
                type: 'linear',
                domain: {data: 'edges', field: 'value'},
                range: {scheme: 'spectral'}
            },
            {
                name: 'opacity',
                type: 'linear',
                domain: {data: 'edges', field: 'groupOpacity'},
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", labels: false, title: 'From (Train Only)'},
            { "orient": "left", "scale": "yscale", labels: false, title: 'To (Train and Test)'}
            ],
            "marks": [
            {   // Just a single square with color based on value
                // Opacity based on group, or hover
                type: 'rect',
                from: {data: 'edges'},
                encode: {
                    enter: {
                        x: {scale: 'xscale', field: 'from'},
                        y: {scale: 'yscale', field: 'to'},
                        width: {scale: 'xscale', band: 1},
                        height: {scale: 'yscale', band: 1},
                        fill: {scale: 'color', field: 'value'}, 
                        opacity: {scale: 'opacity', field: 'groupOpacity'},
                        href: {data: 'edges', field: 'link'}
                    },
                    update: {
                        opacity: [
                            {test: 'datum.to == hover.to || datum.from == hover.from', value: 0.7},
                            {scale: 'opacity', field: 'groupOpacity'}
                        ]
                    },
                    hover: {
                        cursor: {value: 'pointer'},
                    }
                }
            },
            {
                type: 'text',
                from: {data: 'edges'},
                encode: {
                    enter: {
                        x: 20,
                        y: 10,
                        fill: {value: 'black'},
                        text: {data: 'edges', field: 'tofrom'}
                    },
                    update: {
                        opacity: [
                            {test: 'datum.to == hover.to && datum.from == hover.from', value: 1},
                            {value: 0}
                        ]
                    }
                }
            }]
        };
        // Display in the div
        this.render(spec);        
    }
}
