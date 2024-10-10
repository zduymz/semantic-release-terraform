import SemanticReleaseError from "@semantic-release/error";
import AggregateError from "aggregate-error";

export default async function ({ env: { TFC_TOKEN }, logger }) {
  logger.log("Verifying authentication for Terraform Cloud");

  if (!TFC_TOKEN) {
    throw new SemanticReleaseError(
      "TFC_TOKEN is not defined",
      "ENOTOKEN",
      "Please ensure the TFC_TOKEN environment variable is set."
    );
  }

  try {
    const response = await fetch("https://app.terraform.io/api/v2/organizations", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TFC_TOKEN}`,
        "Content-Type": "application/vnd.api+json",
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new SemanticReleaseError(
        `HTTP error: ${response.statusText}`,
        "HTTPERROR",
        `Response status: ${response.status}, Response body: ${errorBody}`
      );
    }

    logger.log("Authentication verified successfully.");
  } catch (error) {
    if (error instanceof SemanticReleaseError) {
      throw error;
    } else {
      throw new AggregateError([new SemanticReleaseError("Network error", "NETWORKERROR", error.message)]);
    }
  }
}
