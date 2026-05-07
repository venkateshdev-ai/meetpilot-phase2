import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { summary, actionItem, meetingTitle, assignee, priority } = body;

    const domain = process.env.JIRA_DOMAIN;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;
    const projectKey = process.env.JIRA_PROJECT_KEY;

    if (!domain || !email || !token || !projectKey) {
      return NextResponse.json(
        { error: "Missing Jira environment variables" },
        { status: 500 }
      );
    }

    const auth = Buffer.from(`${email}:${token}`).toString("base64");

    const issuePayload = {
      fields: {
        project: { key: projectKey },
        summary: summary || actionItem || "MeetPilot action item",
        issuetype: { name: "Task" },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Meeting: ${meetingTitle || "Untitled"}\nAction: ${actionItem || ""}\nAssignee: ${assignee || "Unassigned"}\nPriority: ${priority || "medium"}`,
                },
              ],
            },
          ],
        },
      },
    };

    const jiraResponse = await fetch(`https://${domain}/rest/api/3/issue`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(issuePayload),
    });

    const jiraData = await jiraResponse.json();

    if (!jiraResponse.ok) {
      return NextResponse.json(
        { error: "Jira rejected the request", details: jiraData },
        { status: jiraResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      issueKey: jiraData.key,
      issueUrl: `https://${domain}/browse/${jiraData.key}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
