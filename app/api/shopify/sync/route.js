import axios from "axios";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment",
      },
      { status: 400 }
    );
  }

  const url = `https://${storeDomain}/admin/api/2025-10/customers.json`;

  try {
    const response = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const customers = Array.isArray(response?.data?.customers)
      ? response.data.customers
      : [];

    const simplifiedCustomers = customers.map((customer) => ({
      email: customer?.email ?? null,
      first_name: customer?.first_name ?? null,
      last_name: customer?.last_name ?? null,
      orders_count: typeof customer?.orders_count === "number" ? customer.orders_count : 0,
    }));

    return NextResponse.json(
      {
        status: "success",
        customers: simplifiedCustomers,
      },
      { status: 200 }
    );
  } catch (error) {
    const statusCode = error?.response?.status ?? 500;
    const errorMessage =
      error?.response?.data?.errors ||
      error?.response?.data?.error ||
      error?.message ||
      "Unknown error";

    console.error("Shopify customers sync error:", error?.response?.data || errorMessage);

    return NextResponse.json(
      {
        status: "error",
        message: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
      },
      { status: statusCode }
    );
  }
}







