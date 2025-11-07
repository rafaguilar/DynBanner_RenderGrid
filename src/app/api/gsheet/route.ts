
import { NextRequest, NextResponse } from 'next/server';

// This is a simplified proxy to fetch public Google Sheet data as CSV.
// It relies on the sheet being published to the web as CSV.
// The URL format is: https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={SHEET_NAME}

const getSheetAsCsvUrl = (sheetUrl: string, sheetName: string): string | null => {
    const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch || !sheetIdMatch[1]) {
        return null;
    }
    const sheetId = sheetIdMatch[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
};

export async function POST(req: NextRequest) {
  try {
    const { sheetUrl, sheetName } = await req.json();

    if (!sheetUrl || !sheetName) {
      return NextResponse.json({ error: 'Missing sheetUrl or sheetName' }, { status: 400 });
    }

    const csvUrl = getSheetAsCsvUrl(sheetUrl, sheetName);
    
    if (!csvUrl) {
         return NextResponse.json({ error: 'Invalid Google Sheet URL format.' }, { status: 400 });
    }

    const response = await fetch(csvUrl);

    if (!response.ok) {
      const errorText = await response.text();
      // Google Sheets returns a large HTML error page, so we don't return the full text.
      if (errorText.includes('gid=') || errorText.includes('Request-URI Too Large')) {
          return NextResponse.json({ error: `The sheet tab "${sheetName}" may not exist or is not public.` }, { status: 404 });
      }
      return NextResponse.json({ error: `Failed to fetch Google Sheet. Make sure the sheet and tab are public.` }, { status: response.status });
    }

    const csvText = await response.text();

    // --- Start Debugging Logs ---
    const tabsToLog = ["parent", "creative_data", "Jeep"];
    if (tabsToLog.includes(sheetName)) {
      const headers = csvText.split('\n')[0];
      console.log(`--- Columns for Google Sheet tab: "${sheetName}" ---`);
      console.log(headers);
      console.log(`----------------------------------------------------`);
    }
    // --- End Debugging Logs ---
    
    return new NextResponse(csvText, {
        status: 200,
        headers: { 'Content-Type': 'text/csv' }
    });

  } catch (error) {
    console.error('GSheet fetch error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
