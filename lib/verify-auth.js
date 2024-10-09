export default async function ({ env: { TFC_TOKEN }, logger }) {
  logger.log("Verify authentication for Terraform Cloud");
  const [err, resp] = await fetch("https://app.terraform.io/api/v2/organizations", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TFC_TOKEN}`,
      "Content-Type": "application/vnd.api+json",
    },
  });
  if (err) {
    throw new Error(`Network error: ${err}`);
  }

  if (!resp.ok) {
    throw new Error(`HTTP error! status: ${resp.status}`);
  }
}
