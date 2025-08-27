  /* ================== CONFIG (GLOBAL) ================== */
  /* 🔗 Cambia estas 2 líneas por tu URL /exec real */
 window.API_BASE = "https://script.google.com/macros/s/AKfycbyCB2ePX6FQ0nhr84OQ_djgmJh-ZLkOQre3KKLjg6h-c_TBRbguNLf2_soO8rB-bkGA-Q/exec";
  window.ADD_STOCK_URL = "https://script.google.com/macros/s/AKfycbyqsU1RHEkIrVcyWVmArCqEVnQ8TAgohlrkLIebXS-JLDJjHkXeatoB6wjmUo8Hl2XaoQ/exec";
  /* ============== ESTADO & UTILIDADES ============== */
  let DATA = [];

  function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg||'Hecho'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); }
  function showLoader(v){ document.getElementById('loader').classList.toggle('show', !!v); }

  /* Inicializa botón y carga inventario */
  document.addEventListener('DOMContentLoaded', ()=>{
    document.title = "Ventas conectadas ✔️";
    document.getElementById('btnAdd').href = window.ADD_STOCK_URL || '#';
    cargar();
  });

  /* ============== CARGAR STOCK (GET) ============== */
  async function cargar(){
    const f=document.getElementById('fecha'); if(f && !f.value) f.value=todayISO();
    try{
      showLoader(true);
      const res = await fetch(`${window.API_BASE}?view=api&fn=stock`, { cache:'no-store' });
      const json = await res.json();
      if(!json.ok && !Array.isArray(json.items)) throw new Error(json.error||'No se pudo cargar stock');
      DATA = (json.items||[]).sort((a,b)=> (a.sku||'').localeCompare(b.sku||'')); 
      render();
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
        const sku=(p.sku||'').toLowerCase(); const nom=(p.nombre||'').toLowerCase();
        return !q || sku.includes(q) || nom.includes(q);
      })
      .forEach(p=>{
        const tr=document.createElement('tr');
        const sku = p.sku || '';
        const qtyId = 'cant_' + sku;
        const priceId = 'precio_' + sku;
        const totalId = 'total_' + sku;

        // Precio seguro: si no es número válido, dejar vacío
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
                   onkeydown="if(event.key==='Enter'){vender('${sku}','${qtyId}','${priceId}')}" />
            <span id="${totalId}" class="muted">Total: $${(Number.isFinite(precioNum)?precioNum:0).toFixed(2)}</span>
            <button class="btn" onclick="vender('${sku}','${qtyId}','${priceId}')">Vender</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
  }

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

  /* ============== REGISTRAR VENTA (SOLO GET, parámetros planos) ============== */
  async function vender(sku, qtyId, priceId){
    const cantidad = Number(document.getElementById(qtyId).value||1);
    if(!Number.isFinite(cantidad)||cantidad<=0){ alert('Cantidad inválida'); return; }

    const precioUnit = document.getElementById(priceId).value;
    const cliente = (document.getElementById('cliente').value||'').trim();
    const fechaISO = document.getElementById('fecha').value;
    const descPct = Number(document.getElementById('descPct').value||0);
    const impPct  = Number(document.getElementById('impPct').value||0);
    const formaPago = (document.getElementById('pago').value||'');
    const nota = document.getElementById('nota').value || (cliente ? `Venta a ${cliente}` : 'Venta web');

    try{
      showLoader(true);

      const params = new URLSearchParams({
        view:'api',
        fn:'registersalev2',
        sku,
        cantidad:String(cantidad),
        cliente,
        precioUnit:String(precioUnit),
        fechaISO,
        descPct:String(descPct),
        impPct:String(impPct),
        formaPago,
        nota
      });

      const url = `${window.API_BASE}?${params.toString()}`;
      console.log('URL Venta GET =>', url);

      const res = await fetch(url, { cache:'no-store' });
      const text = await res.text();   // primero como texto por si viene HTML
      console.log('Respuesta texto =>', text.slice(0,200));

      if (text.trim().startsWith('<')) {
        alert('El backend devolvió HTML (no JSON). Verifica view=api y fn=registersalev2 en tu doGet y usa la URL /exec del último deploy.');
        return;
      }

      const json = JSON.parse(text);
      if(!json.ok){ alert(json.error || 'No se pudo vender'); return; }

      const total = (json.result && typeof json.result.total === 'number') ? json.result.total.toFixed(2) : '0.00';
      toast(`Venta registrada ($${total})`);
      await cargar();

    }catch(err){
      console.error(err);
      alert(err.message||'Error al vender');
    }finally{
      showLoader(false);
    }
  }