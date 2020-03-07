class PdSvg extends HTMLElement
{
	constructor ()
	{
		super();
		this.attachShadow ({mode:"open"});
		this.shadowRoot.innerHTML = `
			<style>
			:host {
				display : inline-block;
			}
			text {
				font : bold 13px monospace;
				fill : var(--color-text);
			}
			.obj,
			.msg {
				fill         : none;
				stroke       : var(--color-bord);
				stroke-width : 1px; // TODO: use var?
			}
			.conn {
				fill         : none;
				stroke       : var(--color-line);
				stroke-width : 1px; // TODO: use var?
			}
			</style>
			<svg></svg>
		`;
		this._svg   = this.shadowRoot.querySelector("svg");
		this._SVGNS = "http://www.w3.org/2000/svg";
		/* array of object and port positions
		{
			bbox : the boundary box of the element
			ioff : array of inlet x positions (relative to bbox.x)
			ooff : array on outlet x positions (relative to bbox.y)
		}
		index in array is the pd connect number */
		this._poss = [];
	}

	set patch (p)
	{
		this._patch = p;
		this._plot_patch();
	}

	_plot_patch ()
	{
		let pos_count = 0;
		let port_workaround_done = false;
		this._svg.innerHTML = "";
		this._patch.split("\n").forEach((line)=>{
			let m = line.match(/^#([A-Z]{1}) ([a-z]+) (.*);$/);
			if (!m) return;
			let ctype = m[1];
			let etype = m[2];
			let param = m[3];
			if (ctype == "N" && etype == "canvas") {
				this._plot_patch_canvas(param);
				return;
			}
			if (ctype == "X" && ["obj","msg"].includes(etype)) {
				let bbox = this["_plot_patch_"+etype](param);
				let poss = { bbox: bbox, ioff: [], ooff: [] };
				this._poss[pos_count] = poss;
				pos_count++;
				return;
			}
			if (ctype == "X" && etype == "connect") {
				if (!port_workaround_done) {
					this._count_ports_workaround();
					port_workaround_done = true;
				}
				this._plot_patch_connect(param)
				return;
			}
		});
	}

	/* as there is no info about pd elements inlet/outlet ports,
	we loop through all connects and just assume the highest
	port number is the amount of ports for this element... */
	// IMPORTANT! the pd to-be-connected elements have to be filled in this._poss first!
	_count_ports_workaround ()
	{
		// first we fill this._poss with just the ports
		this._patch.split("\n").forEach((line)=>{
			let m = line.match(/^#X connect (.*);$/);
			if (!m) return;
			let d = m[1].split(" ");
			let source = parseInt(d[0]);
			let outlet = parseInt(d[1]);
			let target = parseInt(d[2]);
			let inlet  = parseInt(d[3]);

			let source_poss = this._poss[source];
			source_poss.ooff[outlet] = null;
			this._poss[source] = source_poss;

			let target_poss = this._poss[target];
			target_poss.ioff[inlet] = null;
			this._poss[target] = target_poss;
		});

		// then we calculate their positions (for connect line)
		// NOTE: the bbox has to be already filled!
		this._poss.forEach((poss)=>{
			let l = poss.ioff.length;
			let w = poss.bbox.width / l;
			poss.ioff.forEach((_, i)=>{
				let p = 0;
				if (l > 1 && i == l-1) {
					p = poss.bbox.width;
				} else if (i > 0) {
					p = (w * i) + (w / 2);
				}
				poss.ioff[i] = p;
			});
			l = poss.ooff.length;
			w = poss.bbox.width / l;
			poss.ooff.forEach((_, i)=>{
				let p = 0;
				if (l > 1 && i == l-1) {
					p = poss.bbox.width;
				} else if (i > 0) {
					p = (w * i) + (w / 2);
				}
				poss.ooff[i] = p;
			});
		});
	}

	_plot_patch_connect (d)
	{
		let m = d.split(" ");
		let source = parseInt(m[0]);
		let outlet = parseInt(m[1]);
		let target = parseInt(m[2]);
		let inlet  = parseInt(m[3]);

		let sx = this._poss[source].bbox.x + this._poss[source].ooff[outlet];
		let sy = this._poss[source].bbox.y + this._poss[source].bbox.height;
		let tx = this._poss[target].bbox.x + this._poss[target].ioff[inlet];
		let ty = this._poss[target].bbox.y;

		this._create_svg_connect(sx, sy, tx, ty);
	}

	// TODO: sub canvas... for now, do not use more than one canvas...
	_plot_patch_canvas (p)
	{
		let d = p.split(" ");
		let x_posi = d[0];
		let y_posi = d[1];
		let x_size = d[2];
		let y_size = d[3];
		let name   = d[4];
		let open   = d[5];

		this._svg.setAttribute("viewBox", [0, 0, x_size, y_size].join(" "));
		this._svg.setAttribute("width", x_size);
		this._svg.setAttribute("height", y_size);
	}

	_plot_patch_obj (p)
	{
		let d = p.split(" ");
		let x_posi = d[0];
		let y_posi = d[1];
		let text   = d.slice(2).join(" ");

		let [el_text, tbox] = this._create_svg_text(x_posi, y_posi, text);
		tbox.x += 0.5; // to make it render sharp
		tbox.y += 0.5; // to make it render sharp

		let el_rect = document.createElementNS(this._SVGNS, "rect");
		el_rect.setAttribute("x", tbox.x);
		el_rect.setAttribute("y", tbox.y);
		el_rect.setAttribute("width", tbox.width);
		el_rect.setAttribute("height", tbox.height);
		el_rect.setAttribute("class", "obj");
		this._svg.appendChild(el_rect);

		return tbox;
	}

	_plot_patch_msg (p)
	{
		p = p.replace(/ \\,/g, ","); // wat?
		p = p.replace(/\\/g, ""); // wat?
		let d = p.split(" ");
		let x_posi = d[0];
		let y_posi = d[1];
		let text   = d.slice(2).join(" ");

		let [el_text, tbox] = this._create_svg_text(x_posi, y_posi, text);
		tbox.x += 0.5; // to make it render sharp
		tbox.y += 0.5; // to make it render sharp

		// TODO: relative to font size?
		let o = 5;

		let el_poly = document.createElementNS(this._SVGNS, "polygon");
		el_poly.setAttribute("points", [
			[tbox.x,              tbox.y].join(","),
			[tbox.x+tbox.width+o, tbox.y].join(","),
			[tbox.x+tbox.width,   tbox.y+o].join(","),
			[tbox.x+tbox.width,   tbox.bottom-o].join(","),
			[tbox.x+tbox.width+o, tbox.bottom+0.5].join(","),
			[tbox.x,              tbox.bottom+0.5].join(","),
		].join(" "));
		el_poly.setAttribute("class", "msg");
		this._svg.appendChild(el_poly);

		return tbox;
	}

	_create_svg_connect (x1, y1, x2, y2)
	{
		let el = document.createElementNS(this._SVGNS, "line");
		el.setAttribute("x1", x1);
		el.setAttribute("y1", y1);
		el.setAttribute("x2", x2);
		el.setAttribute("y2", y2);
		el.setAttribute("class", "conn");
		this._svg.appendChild(el);
	}

	_create_svg_text (x, y, text)
	{
		let el_text = document.createElementNS(this._SVGNS, "text");
		el_text.setAttribute("x", x);
		el_text.setAttribute("y", y);
		el_text.setAttribute("dominant-baseline", "hanging");
		el_text.textContent = text;
		this._svg.appendChild(el_text);
		let tbox = el_text.getBoundingClientRect();
		tbox = this._fix_bbox_offset(tbox);
		return [el_text, tbox];
	}

	_fix_bbox_offset(target)
	{
		let parent = this._svg.getBoundingClientRect();
		let XOFF   = parent.x;
		let YOFF   = parent.y;
		return {
			x      : target.x - XOFF,
			y      : target.y - YOFF,
			top    : target.top - YOFF,
			right  : target.right - XOFF,
			bottom : target.bottom - YOFF,
			left   : target.left - XOFF,
			width  : target.width,
			height : target.height
		}
	}
}

customElements.define("pd-svg", PdSvg);
