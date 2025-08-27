 /* ================== CONFIG (GLOBAL) ================== */
  window.API_BASE = "https://script.google.com/macros/s/AKfycbwCrAIImGMAXCrP5TxpqbCxAqcKPfai8aJ9tVw9FeJS6iIbcS9xQhNXC7fiFE263Or55w/exec";
  window.ADD_STOCK_URL = "https://script.google.com/macros/s/AKfycbxpgbgGWUvR7okd1NG0HwprNbaXIeKgKQPsJg2mZzF0fwiET7P5ZiCyQNZZwGlwMKrFRg/exec";

  /* ============== ESTADO & UTILIDADES ============== */
  let DATA = [];
  let CART = []; // [{sku, nombre, precioUnit, cantidad, ubicacion}]

  function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg||'Hecho'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }
  function showLoader(v){ document.getElementById('loader').classList.toggle('show', !!v); }

  document.addEventListener('DOMContentLoaded', ()=>{
    document.title = "Ventas conectadas ✔️";
    document.getElementById('btnAdd').href = window.ADD_STOCK_URL || '#';
    const f=document.getElementById('fecha'); if(f && !f.value) f.value=todayISO();
    cargar();
  });

  /* ============== CARGAR STOCK (GET) ============== */
  async function cargar(){
    try{
      showLoader(true);
      const res = await fetch(`${window.API_BASE}?view=api&fn=stock`, { cache:'no-store' });
      const json = await res.json();
      if(!json.ok) throw new Error(json.error||'No se pudo cargar stock');
      DATA = (json.items||[]).sort((a,b)=> (a.sku||'').localeCompare(b.sku||'')); 
      render();
      pintarCarrito();
    }catch(err){ toast(err.message||'Error al cargar'); console.error(err); }
    finally{ showLoader(false); }
  }

  /* ============== PINTAR TABLA ============== */
  function render(){
    const q=(document.getElementById('q').value||'').toLowerCase().trim();
    const tbody=document.querySelector('#tabla tbody');
    tbody.innerHTML='';

    (DATA||[])
      .filter(p=>{
        const sku=(p.sku||'').toLowerCase(), nom=(p.nombre||'').toLowerCase();
        return !q || sku.includes(q) || nom.includes(q);
      })
      .forEach(p=>{
        const tr=document.createElement('tr');
        const sku = p.sku || '';
        const qtyId = 'cant_' + sku;
        const priceId = 'precio_' + sku;
        const totalId = 'total_' + sku;

        const precioNum = Number(p.precio);
        const precioVal = Number.isFinite(precioNum) ? precioNum.toFixed(2) : '';

        tr.innerHTML = `
          <td><b>${sku}</b></td>
          <td>${p.nombre||''}</td>
          <td><span class="pill">${Number(p.stock)||0}</span></td>
          <td>
            <input type="number" id="${priceId}" step="0.01" min="0" value="${precioVal}" class="price"
                   oninput="recalc('${qtyId}','${priceId}','${totalId}')">
          </td>
          <td>${p.ubicacion||''}</td>
          <td>
            <input type="number" id="${qtyId}" min="1" value="1" class="qty"
                   oninput="recalc('${qtyId}','${priceId}','${totalId}')"
                   onkeydown="if(event.key==='Enter'){addToCart('${sku}','${qtyId}','${priceId}','${(p.nombre||'').replace(/"/g,'&quot;')}','${p.ubicacion||''}')}"/>
            <span id="${totalId}" class="muted">Total: $${(Number.isFinite(precioNum)?precioNum:0).toFixed(2)}</span>
            <button class="btn" onclick="addToCart('${sku}','${qtyId}','${priceId}','${(p.nombre||'').replace(/"/g,'&quot;')}','${p.ubicacion||''}')">🛒 Agregar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

  /* ============== CALCULO POR FILA (visual) ============== */
  function recalc(qtyId, priceId, totalId){
    const n = Number(document.getElementById(qtyId)?.value || 1);
    const p = Number(document.getElementById(priceId)?.value);
    const desc = Number(document.getElementById('descPct')?.value || 0);
    const imp  = Number(document.getElementById('impPct')?.value || 0);
    let total = (Number.isFinite(p) ? p : 0) * (Number.isFinite(n) ? n : 0);
    if(Number.isFinite(desc) && desc) total *= (1 - desc/100);
    if(Number.isFinite(imp)  && imp)  total *= (1 + imp/100);
    const el=document.getElementById(totalId);
    if(el) el.textContent = `Total: $${total.toFixed(2)}`;
  }

  /* ============== CARRITO ============== */
  function addToCart(sku, qtyId, priceId, nombre, ubicacion){
    const cantidad = Number(document.getElementById(qtyId)?.value||1);
    const precioUnit = document.getElementById(priceId)?.value;
    if (!Number.isFinite(cantidad) || cantidad<=0) { toast('Cantidad inválida'); return; }
    const pNum = Number(precioUnit);
    if (!Number.isFinite(pNum) || pNum < 0) { toast('Precio inválido'); return; }

    // Si ya existe, acumulamos
    const idx = CART.findIndex(x=> x.sku === sku);
    if (idx >= 0) {
      CART[idx].cantidad += cantidad;
      CART[idx].precioUnit = pNum;
    } else {
      CART.push({ sku, nombre, precioUnit: pNum, cantidad, ubicacion });
    }
    pintarCarrito();
    toast(`Agregado ${cantidad} × ${sku}`);
  }

  function pintarCarrito(){
    const list = document.getElementById('cartList');
    const totEl = document.getElementById('cartTotal');
    if (!list || !totEl) return;

    if (!CART.length) {
      list.innerHTML = '<div class="muted">Vacío</div>';
      totEl.textContent = 'Total: $0.00';
      return;
    }

    let html = '<table style="width:100%; border-collapse:collapse">';
    html += '<thead><tr><th style="text-align:left">SKU</th><th style="text-align:left">Producto</th><th>Cant</th><th>Precio</th><th>Total</th><th></th></tr></thead><tbody>';

    let total = 0;
    CART.forEach((it, i)=>{
      const line = (Number(it.precioUnit)||0) * (Number(it.cantidad)||0);
      total += line;
      html += `<tr>
        <td>${it.sku}</td>
        <td>${it.nombre||''}</td>
        <td class="center">${it.cantidad}</td>
        <td class="right">$${(Number(it.precioUnit)||0).toFixed(2)}</td>
        <td class="right">$${line.toFixed(2)}</td>
        <td><button class="btn-ghost" onclick="removeFromCart(${i})">🗑️</button></td>
      </tr>`;
    });
    html += '</tbody></table>';
    list.innerHTML = html;

    const desc = Number(document.getElementById('descPct')?.value||0);
    const imp  = Number(document.getElementById('impPct')?.value||0);
    if (Number.isFinite(desc) && desc) total *= (1 - desc/100);
    if (Number.isFinite(imp)  && imp)  total *= (1 + imp/100);

    totEl.textContent = `Total: $${total.toFixed(2)}`;
  }

  function removeFromCart(i){ CART.splice(i,1); pintarCarrito(); }
  function vaciarCarrito(){ CART = []; pintarCarrito(); }

  /* ============== REGISTRAR VENTA (CARRITO) ============== */
  async function venderCarrito(){
    if (!CART.length) { alert('Carrito vacío'); return; }

    const cliente = (document.getElementById('cliente')?.value||'').trim();
    const fechaISO = document.getElementById('fecha')?.value || '';
    const descPct = Number(document.getElementById('descPct')?.value||0);
    const impPct  = Number(document.getElementById('impPct')?.value||0);
    const formaPago = (document.getElementById('pago')?.value||'');
    const nota = document.getElementById('nota')?.value || (cliente ? `Venta a ${cliente}` : 'Venta múltiple');

    // Cart como JSON en un solo parámetro
    const cartParam = encodeURIComponent(JSON.stringify(CART.map(x=>({
      sku:x.sku, cantidad:Number(x.cantidad||0), precioUnit:Number(x.precioUnit||0)
    }))));

    const params = new URLSearchParams({
      view:'api',
      fn:'registersalebatch',
      cart: decodeURIComponent(cartParam),
      cliente, fechaISO,
      descPct:String(descPct),
      impPct:String(impPct),
      formaPago, nota
    });

    try{
      showLoader(true);
      const url = `${window.API_BASE}?${params.toString()}`;
      const res = await fetch(url, { cache:'no-store' });
      const text = await res.text();
      if (text.trim().startsWith('<')) { alert('El backend devolvió HTML (no JSON). Verifica tu doGet y el /exec actual.'); return; }
      const json = JSON.parse(text);
      if (!json.ok) throw new Error(json.error||'No se pudo vender');

      const total = (json.result && typeof json.result.total === 'number') ? json.result.total.toFixed(2) : '0.00';
      toast(`Venta múltiple registrada ($${total})`);
      vaciarCarrito();
      await cargar();
    }catch(err){
      console.error(err);
      alert(err.message||'Error al vender carrito');
    }finally{
      showLoader(false);
    }
  }

  /* ============== PDF SEMANAL ============== */
  async function pdfSemanal(){
    try{
      showLoader(true);
      const url = `${window.API_BASE}?view=api&fn=weeklypdf`;
      const res = await fetch(url, { cache:'no-store' });
      const json = await res.json();
      if(!json.ok) throw new Error(json.error || 'No se pudo generar PDF');
      const link = json.report && json.report.url;
      if (!link) throw new Error('No se recibió URL del PDF');
      window.open(link, '_blank');
    }catch(err){
      console.error(err);
      alert(err.message||'Error al generar PDF');
    }finally{
      showLoader(false);
    }
  }

  // Poner fecha y hora actual en el input
  const fechaInput = document.getElementById('fecha');
  const ahora = new Date();
  const fechaFormateada = ahora.toLocaleString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  fechaInput.value = fechaFormateada;