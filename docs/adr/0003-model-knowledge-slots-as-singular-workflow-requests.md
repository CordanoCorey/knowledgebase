# Model Knowledge Slots as Singular Workflow Requests

Knowledge Slots are workflow records, not Knowledge Types, and each slot requests exactly one Knowledge Entry of a specified Knowledge Type within a frozen Knowledge Context. The slot stores workflow state such as status and due date, captures its required Tags at creation, and may point to the single Knowledge Entry that fulfills it. This keeps slot fulfillment simple and stable while Series, Groups, and repeated slot creation handle workflows that need many requested entries.
