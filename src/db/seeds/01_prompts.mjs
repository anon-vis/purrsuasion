export const seed = async function (knex) {
  await knex("prompts").del();
  await knex("prompts").insert([
    {
      instructions:
        "You’re a city logistics planner allocating inspection teams for next month. Outliers in either workload or lateness could signal bottlenecks or failing warehouses. You need to be able to identify which warehouses are atypical so you can plan targeted audits. Your task is to choose a data broker (sender) who you trust to provide this information in full upon signing a contract.",
      condensed_instructions: "Show which warehouses are outliers.",
      category: "Outliers and Individual Points",
      is_for_receiver: true,
    },
    {
      instructions:
        "You’re a data broker selling a dataset on warehouse performance. You want to build trust by demonstrating that the dataset contains the information that your potential client (the receiver) needs. However, to protect your supplier relationships and to avoid pinpointing individual warehouses, you should hide warehouses and zone identities in your visualizations.",
      condensed_instructions: "Hide individual warehouses and zones.",
      category: "Outliers and Individual Points",
      is_for_receiver: false,
    },
    {
      instructions:
        "You’re an environmental analyst who is helping identify when and where pollution levels peak or drop significantly. Your task is to choose a data broker (sender) who you trust to provide the data your team needs to guide policy decisions concerning pollution sources or behaviors. ",
      condensed_instructions:
        "Show peaks and troughs where pollution is especially high and low.",
      category: "Peaks and Gaps",
      is_for_receiver: true,
    },
    {
      instructions:
        "You’re a data broker selling a high-resolution air-quality dataset. You want to build trust by demonstrating that the dataset contains the information that your potential client (the receiver) needs. But to protect proprietary collection patterns, you cannot expose the exact location of gaps in the data distribution in your visualizations.",
      condensed_instructions: "Hide exact location of gaps in the data.",
      category: "Peaks and Gaps",
      is_for_receiver: false,
    },
    {
      instructions:
        "You are an analyst working with a tenants’ rights group. Your job is to explore how retail stores are spread across the US to get a sense of where saturation is high or low. Your task is to choose a data broker (sender) who you trust to provide the data needed to better understand the patterns you are looking for.",
      condensed_instructions: "Show areas where retail saturation is high.",
      category: "Hot Spots and MAUP",
      is_for_receiver: true,
    },
    {
      instructions:
        "You are a data broker who maintains a detailed dataset of retail stores, including their locations and counts across different areas of the country. Your job is to share visualizations that show the dataset contains information that your client (the receiver) needs. However, you should not show very fine-grained details (like individual blocks or exact storefront locations) that landlords or large chains could use to raise rents in specific areas.",
      condensed_instructions: "Hide specific store locations.",
      category: "Hot Spots and MAUP",
      is_for_receiver: false,
    },
  ]);
};
