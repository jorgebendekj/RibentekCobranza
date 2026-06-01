import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// URL del backend de Ribentek (Vercel) donde se envía el mensaje
const BACKEND_URL = Deno.env.get("BACKEND_URL") || "https://ribentek-cobranza.vercel.app";
// Secreto compartido para autenticar webhooks internos
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_INTERNAL_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  try {
    // Solo permitimos POST
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // El payload que manda el Database Webhook
    const payload = await req.json();
    console.log("Recibido webhook de BD:", JSON.stringify(payload));

    // Validar que el evento sea de debt_details y tenga record
    if (payload.table !== "debt_details" || !payload.record) {
      return new Response("Invalid payload", { status: 400 });
    }

    const record = payload.record;

    // Solo procesar si el estado es 'Paid'
    if (record.debt_status !== "Paid") {
      return new Response("Not Paid, ignoring.", { status: 200 });
    }

    const invoiceId = record.id;
    const contactId = record.contact_id;
    const debtDescription = record.debt_description || "Sin concepto";
    const amount = record.debt_amount || record.total;

    // ─── 1. Obtener datos del cliente (contacts) ───
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("name, phone_number, tenant_id")
      .eq("id", contactId)
      .limit(1)
      .single();

    if (contactErr || !contact) {
      console.error("Error obteniendo cliente:", contactErr);
      return new Response(JSON.stringify({ error: "Client fetch error" }), { status: 500 });
    }

    // ─── 2. Obtener datos del tenant ───
    let tenantName = "AiCobranzas";
    if (contact.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", contact.tenant_id)
        .limit(1)
        .single();

      if (tenant) {
        tenantName = tenant.name;
      }
    }

    // ─── 3. Construir URL del PDF del recibo ───
    const pdfUrl = `${BACKEND_URL}/mcp/receipt/${invoiceId}/pdf`;

    // ─── 4. Formatear monto ───
    const formattedAmount = `$${Number(amount).toFixed(2)}`;

    // ─── 5. Limpiar número de teléfono ───
    const phoneNumber = contact.phone_number?.replace(/[^0-9]/g, "") || "";
    if (!phoneNumber) {
      console.error("Cliente sin número de teléfono:", contactId);
      return new Response(
        JSON.stringify({ error: "Contact has no phone number" }),
        { status: 400 }
      );
    }

    // ─── 6. Llamar al backend de Ribentek para que envíe la plantilla ───
    const backendPayload = {
      tenant_id: contact.tenant_id,
      phone_number: phoneNumber,
      template_name: "invoice_related",
      template_parameters: [formattedAmount, debtDescription, "recibo"],
      header_document: {
        link: pdfUrl,
        filename: `Recibo_${invoiceId.substring(0, 8)}.pdf`,
      },
      // Metadata extra para contexto
      metadata: {
        invoice_id: invoiceId,
        contact_id: contactId,
        customer_name: contact.name || "Cliente",
        tenant_name: tenantName,
      },
    };

    console.log("Enviando al backend de Ribentek:", JSON.stringify(backendPayload));

    const backendResponse = await fetch(
      `${BACKEND_URL}/webhooks/internal/payment-receipt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify(backendPayload),
      }
    );

    const backendResult = await backendResponse.json();

    if (!backendResponse.ok) {
      console.error("Error del backend:", JSON.stringify(backendResult));
      return new Response(
        JSON.stringify({ error: "Backend error", details: backendResult }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Respuesta del backend:", JSON.stringify(backendResult));

    return new Response(
      JSON.stringify({
        success: true,
        whatsapp_message_id: backendResult.whatsapp_message_id || null,
        sent_to: phoneNumber,
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Internal Edge Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
