
class SimilarityLineGraph extends VegaDivAdapter {
    constructor(bar, div) {
        super(div);
        this.bar = bar;
    }

    getGroup(Groups, subjidx) {
        if (Groups) {
            for (const name in Groups) {
                if (Groups[name].includes(subjidx)) return name;
            }
        }
        return '';
    }
   
    // FromTo is an object with a from or to field holding idx
    repaint(runidx, fromTo) {
        const run = this.bar.runs[runidx];
        const sim = run.sim;
        if (!sim) {
            this.repaintEmpty(`No similarity for run ${runidx}`);
            return;
        }
        if (!sim.From.includes(fromTo.from) && !sim.To.includes(fromTo.to)) {
            this.repaintEmpty(`No valid from or to field in fromTo`);
            return;
        }
        if (sim.From.includes(fromTo.from) && sim.To.includes(fromTo.to)) {
            this.repaintEmpty(`Both from and to field in fromTo`);
            return;
        }
        // Get graph values
        const edges = sim.Edges;
        const from = sim.From;
        const to = sim.To;
        const values = [];
        for (let i=0, c=0; i<edges.length; i++) {
           if (fromTo.from == from[i] || fromTo.to == to[i]) {
               // Looking for opposite end of from-to
               // Vega does not allow same line to be different colors!
               // Must replicate all lines for all groups
               const idx = fromTo.from == from[i] ? to[i] : from[i];
               // Included group
               values.push({
                   value: edges[i],
                   id: ++c,
                   group: this.getGroup(sim.Groups, idx)
               });
               // Not included group
               if (sim.Groups) {
                   Object.keys(sim.Groups).forEach(gname => {
                       if (!sim.Groups[gname].includes(idx)) {
                           values.push({
                               value: 0,
                               id: c,
                               group: gname
                           });
                       }
                   });
               }
           }
        }
        // Get graph title
        let title;
        if (fromTo.from || fromTo.from === 0) {
            const fromId = (sim.FromIds ?? [])[fromTo.from];
            const groupText = (sim.Groups) ? `, Group: ${this.getGroup(sim.Groups, fromTo.from)}` : '';
            title = `How Subject ${fromTo.from} (ID: ${fromId}${groupText}) Affects Other Subjects (From)`;
        } else {
            const toId = (sim.ToIds ?? [])[fromTo.to];
            const groupText = (sim.Groups) ? `, Group: ${this.getGroup(sim.Groups, fromTo.to)}` : '';
            title = `How Subject ${fromTo.to} (ID: ${toId}${groupText}) is Affected By Other Subjects (To)`;
        }
        const style = getComputedStyle(this.div);
        const width = parseInt(style.width)-80;
        const height = parseInt(style.height)-140;
        console.log(values);
        vega.scheme('basic', ['red', 'green', 'blue']);
        const spec = {
            "$schema": "https://vega.github.io/schema/vega/v5.json",
            "width": width,
            "height": height,
            "padding": 0,
            title: title,
            "data": [
            {
                name: 'edges',
                values: values,
            }],
            "scales": [
            {
                "name": "xscale",
                "type": "band",
                "domain": {"data": "edges", "field": "id"},
                "range": "width",
                nice: true,
                "padding": 0,
            },
            {
                "name": "yscale",
                type: 'linear',
                domain: {data: 'edges', field: 'value'},
                "range": "height",
                nice: true,
                padding: 0,
            },
            {
                name: 'color',
                type: 'ordinal',
                domain: {data: 'edges', field: 'group'},
                range: {scheme: 'category10'},
            }],
            "axes": [
            { "orient": "bottom", "scale": "xscale", labels: false, title: 'Subject'},
            { "orient": "left", "scale": "yscale", title: 'Similarity'}
            ],
            legends: [{
                stroke: 'color',
                title: 'Group',
                orient: 'top',
                direction: 'horizontal'
            }],
            "marks": [
            {
                type: 'group',
                from: {
                    facet: {
                        name: 'series',
                        data: 'edges',
                        groupby: 'group'
                    }
                },
                marks:[
                {   // Just a single square with color based on value
                    // Opacity based on group, or hover
                    type: 'line',
                    from: {data: 'series'},
                    encode: {
                        enter: {
                            x: {scale: 'xscale', field: 'id'},
                            y: {scale: 'yscale', field: 'value'},
                            stroke: {scale: 'color', field: 'group'}
                            /*[
                                {test: 'datum.group == ""', value: 'steelblue'},
                                {scale: 'color', field: 'group'}
                            ]*/
                        },
                    }
                }]
            }]
        };
        // Display in the div
        this.render(spec);
    }
}
