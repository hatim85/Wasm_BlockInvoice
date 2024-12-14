"use client";
import { Abstraxion as AbstraxionSDK, useAbstraxionAccount, useModal } from "@burnt-labs/abstraxion";
import { Button } from "@burnt-labs/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Correctly used inside a client-side component
import type {GranteeSignerClient} from "@burnt-labs/abstraxion-core"
import { CONTRACTS, TREASURY } from "./utils/constants";
import type { ExecuteResult } from "@cosmjs/cosmwasm-stargate";

type ExecuteResultOrUndefined = ExecuteResult | string | undefined;
type InvoiceDetails = {
  recipient: string;
  amount: string;
  description: string;
  payer: string;
  dueDate: string;
  items: Array<{ itemName: string; itemPrice: string }>;
};

type ExecuteMsg = {
  create_invoice: {
    recipient: string;
    amount: string;
    description: string;
    due_date: number;
  };
};

const Abstraxion = require("@burnt-labs/abstraxion") as unknown as AbstraxionClass;

// Set `client` to `undefined` by default
const [client, setClient] = useState<GranteeSignerClient | undefined>(undefined);

async function write(client: GranteeSignerClient | undefined, msg: unknown, sender: string, contract: string) {
  if (!client) return;
  return client.execute(
    sender,
    contract,
    msg,
    {
      amount: [{ amount: "1", denom: "uxion" }],
      gas: "500000",
      granter: TREASURY.treasury
    },
    "",
    []
  );
}

async function read(client: GranteeSignerClient | undefined, msg: unknown, contract: string) {
  if (!client) return;
  return client.queryContractSmart(
    contract,
    msg
  );
}

interface AbstraxionClass {
  new (config: { onClose: () => void }): { getSignerClient(): Promise<GranteeSignerClient> };
}

async function getClient(): Promise<GranteeSignerClient | null> {
  try {
    const abstraxion = new Abstraxion({ onClose: () => console.log("Closed") }); // Initialize the Abstraxion SDK
    return await abstraxion.getSignerClient(); // Obtain the client
  } catch (error) {
    console.error("Error initializing client:", error);
    return null;
  }
}

export default function Page(): JSX.Element {
  const router = useRouter();  // Correctly used inside a client-side component
  const { data: { bech32Address }, isConnected } = useAbstraxionAccount();
  const [, setShow] = useModal();
  const [client, setClient] = useState<GranteeSignerClient | any>(null);

  useEffect(() => {
    // Fetch and set the client on component mount
    getClient().then(setClient);
  }, []);

  const [address, setAddress] = useState<string | null>(null);

   const [status, setStatus] = useState<string | null>(null);
  const [invoicePdfUrl, setInvoicePdfUrl] = useState<string | null>(null);

  // Invoice state
  const [invoiceDetails, setInvoiceDetails] = useState({
    recipient: "",
    amount: "",
    description: "",
    payer: "",
    dueDate: "",
    items: [{ itemName: "", itemPrice: "" }],
  });

  useEffect(() => {
    if (isConnected && bech32Address) {
      setAddress(bech32Address);
      router.push(`/?address=${bech32Address}`);
    }
  }, [isConnected, bech32Address, router,address,router]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const addressFromURL = urlParams.get("address");
    if (addressFromURL) {
      setAddress(addressFromURL);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoiceDetails((prevDetails) => ({ ...prevDetails, [name]: value }));
  };

  const handleItemChange = (index: number, field: keyof InvoiceDetails['items'][number], value: string) => {
    setInvoiceDetails((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };
  

  const handleAddItem = () => {
    setInvoiceDetails((prevDetails) => ({
      ...prevDetails,
      items: [...prevDetails.items, { itemName: "", itemPrice: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = invoiceDetails.items.filter((_, i) => i !== index);
    setInvoiceDetails((prevDetails) => ({ ...prevDetails, items: updatedItems }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Creating invoice...");

    const totalAmount = invoiceDetails.items.reduce((sum, item) => {
      const price = parseFloat(item.itemPrice);
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const msg: ExecuteMsg = {
      create_invoice: {
        recipient: invoiceDetails.recipient,
        amount: totalAmount.toString(),
        description: invoiceDetails.description,
        due_date: new Date(invoiceDetails.dueDate).getTime(),
      },
    };

    try {
      const result = await write(client, msg, bech32Address!, CONTRACTS.Invoice); // Correct client and contract usage
      setStatus("Invoice created successfully!");
      setInvoicePdfUrl("https://example.com/invoice.pdf"); // Replace with real URL
    } catch (error) {
      console.error("Error creating invoice:", error);
      setStatus("Failed to create invoice.");
    }
  };

  const totalAmount = invoiceDetails.items.reduce((sum, item) => {
    const price = parseFloat(item.itemPrice);
    return sum + (isNaN(price) ? 0 : price);
  }, 0);
  //createInvoice end

  return (
    <>
      {/* Display Connected Wallet Address */}
      {address && (
        <div className="mb-6 text-lg">
          <p>Connected Wallet Address: {address}</p>
        </div>
      )}

      {/* CONNECT Button for wallet */}
      {!isConnected && (
        <Button
          fullWidth
          onClick={() => { setShow(true); }}
          structure="base"
        >
          CONNECT
        </Button>
      )}

      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        {/* Create Invoice start */}
        <div className="flex flex-col items-center justify-center w-full">
          <h1 className="text-3xl font-bold mb-6">Create Invoice</h1>
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white shadow-lg rounded-lg p-6"
          >
            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2" htmlFor="payer">
                Payer Address
              </label>
              <input
                type="text"
                id="payer"
                name="payer"
                value={invoiceDetails.payer}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter payer address"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2" htmlFor="recipient">
                Recipient Address
              </label>
              <input
                type="text"
                id="recipient"
                name="recipient"
                value={invoiceDetails.recipient}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter recipient wallet address"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2" htmlFor="dueDate">
                Due Date
              </label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={invoiceDetails.dueDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={invoiceDetails.description}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter invoice description"
                rows={4}
              />
            </div>

            <div className="mb-4 space-y-4">
              {invoiceDetails.items.map((item, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <input
                    type="text"
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Item ${index + 1}`}
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                  />
                  <input
                    type="number"
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Price"
                    value={item.itemPrice}
                    onChange={(e) => handleItemChange(index, "itemPrice", e.target.value)}
                  />
                  {invoiceDetails.items.length > 1 && (
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => handleRemoveItem(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="w-full bg-gray-300 text-gray-800 py-2 rounded-md mt-4"
                onClick={handleAddItem}
              >
                Add Item
              </button>
            </div>

            <div className="mt-4 text-lg font-semibold">
              <p>Total Amount: ${totalAmount.toFixed(2)}</p>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-3 rounded-md mt-6"
            >
              Create Invoice
            </button>
          </form>

          {status && <p className="mt-4 text-lg text-center">{status}</p>}

          {invoicePdfUrl && (
            <div className="mt-4">
              <a href={invoicePdfUrl} download>
                <button className="bg-green-500 text-white py-2 px-4 rounded-md">
                  Download Invoice
                </button>
              </a>
            </div>
          )}
        </div>
      </div>
      {/* create invoice end */}
      {/* Navigation links
      <div className="flex space-x-4">
        <Link href="/CreateInvoice" className="bg-blue-500 text-white px-6 py-3 rounded-md">
            Create Invoice
        </Link>
        <Link href="/ViewInvoice" className="bg-green-500 text-white px-6 py-3 rounded-md">
            View Invoice
        </Link>
        <Link href="/PayInvoice" className="bg-purple-500 text-white px-6 py-3 rounded-md">
            Pay Invoice
        </Link>
      </div> */}
    </>
  );
}
