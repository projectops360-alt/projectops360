export type BuyerIntentPageConfig = {
  eyebrow: string;
  title: string;
  metaDescription: string;
  hero: string;
  answerTitle: string;
  answer: string;
  chain: string[];
  signalsTitle: string;
  signalsIntro: string;
  signals: Array<{ title: string; body: string }>;
  methodTitle: string;
  methodIntro: string;
  method: Array<{ title: string; body: string }>;
  comparisonTitle: string;
  comparisonIntro: string;
  comparisonHeaders: [string, string];
  comparison: Array<{ left: string; right: string }>;
  decisionTitle: string;
  decisionIntro: string;
  decisionPoints: Array<{ title: string; body: string }>;
  faq: Array<{ question: string; answer: string }>;
  related: Array<{ href: string; label: string }>;
  disclaimer?: string;
};

export const buyerIntentPages = {
  "project-bottleneck-detection-software": {
    "eyebrow": "Project Bottlenecks · Buyer Guide",
    "title": "Project Bottleneck Detection Software",
    "metaDescription": "Learn what project bottleneck detection software should identify, which execution signals matter, and how to evaluate evidence, dependencies and downstream impact.",
    "hero": "Find where project execution is accumulating waiting, rework and dependency pressure — before a late milestone becomes the first visible symptom.",
    "answerTitle": "What should project bottleneck detection software actually detect?",
    "answer": "Project bottleneck detection software should use execution history to identify where work repeatedly waits, queues, reopens, detours or becomes dependent on a constrained decision, team or predecessor. A useful system does more than flag late tasks: it shows the evidence behind the bottleneck and the downstream work that may be exposed.",
    "chain": [
      "Execution Events",
      "Waiting & Rework",
      "Bottleneck Signal",
      "Evidence",
      "Dependencies",
      "Downstream Impact"
    ],
    "signalsTitle": "Bottleneck signals that are stronger than a red status",
    "signalsIntro": "A bottleneck is a pattern in flow, not simply a task with a late date. These signals become more useful when they persist and affect connected work.",
    "signals": [
      {
        "title": "Queue growth",
        "body": "More work is arriving at a stage, reviewer, team or dependency than is leaving it, creating visible accumulation."
      },
      {
        "title": "Dependency waiting",
        "body": "Multiple activities remain ready but cannot progress because the same predecessor, approval or deliverable is unresolved."
      },
      {
        "title": "Repeated rework",
        "body": "Items repeatedly reopen, move backward or cycle through correction and validation instead of advancing."
      },
      {
        "title": "Decision latency",
        "body": "Execution pauses while governance, scope, architecture or business decisions remain unresolved longer than expected."
      },
      {
        "title": "Handoff delay",
        "body": "Work consistently loses time when responsibility moves between teams, vendors, functions or workstreams."
      },
      {
        "title": "Milestone pressure propagation",
        "body": "One constrained area is connected to several downstream tasks or milestones that are progressively losing schedule margin."
      }
    ],
    "methodTitle": "A 6-step method for detecting project bottlenecks",
    "methodIntro": "Use the execution trail first, then prioritize only the bottlenecks that are supported by evidence and material dependency exposure.",
    "method": [
      {
        "title": "Define expected flow",
        "body": "Document the intended stages, handoffs, milestone gates and critical dependencies that describe how work should move."
      },
      {
        "title": "Collect timestamped execution evidence",
        "body": "Use status changes, dates, blockers, approvals, reopens, dependencies, decisions and other traceable events."
      },
      {
        "title": "Measure waiting and cycling",
        "body": "Identify where work spends disproportionate time waiting, returns to prior states or accumulates in queues."
      },
      {
        "title": "Confirm persistence",
        "body": "Separate one-time exceptions from recurring patterns that repeatedly constrain throughput or schedule progress."
      },
      {
        "title": "Trace downstream exposure",
        "body": "Connect the constrained point to dependent tasks, milestones and workstreams to understand potential blast radius."
      },
      {
        "title": "Intervene and remeasure",
        "body": "Change the constraint, then compare the next execution window to verify that flow actually improved."
      }
    ],
    "comparisonTitle": "Task tracking vs. bottleneck detection",
    "comparisonIntro": "Tracking shows the current condition. Bottleneck detection explains the flow pattern producing that condition.",
    "comparisonHeaders": [
      "Traditional tracking",
      "Bottleneck detection"
    ],
    "comparison": [
      {
        "left": "Task is overdue",
        "right": "Where did the task spend time waiting or repeating?"
      },
      {
        "left": "Milestone is red",
        "right": "Which constrained flow pattern is feeding the milestone risk?"
      },
      {
        "left": "Blocker is logged",
        "right": "Is the same blocker type recurring across connected work?"
      },
      {
        "left": "Dependency exists",
        "right": "How much downstream work is actually waiting on it?"
      }
    ],
    "decisionTitle": "What to evaluate before buying bottleneck detection software",
    "decisionIntro": "Prefer systems that expose evidence and execution mechanics rather than producing a black-box risk score.",
    "decisionPoints": [
      {
        "title": "Event history",
        "body": "Can the system analyze how work changed over time rather than only the latest snapshot?"
      },
      {
        "title": "Flow reconstruction",
        "body": "Can it reconstruct waiting, loops, handoffs and sequence deviations?"
      },
      {
        "title": "Dependency context",
        "body": "Can it connect the bottleneck to downstream tasks and milestones?"
      },
      {
        "title": "Traceable evidence",
        "body": "Can a PM or PMO inspect why the system surfaced the bottleneck?"
      }
    ],
    "faq": [
      {
        "question": "What is a project bottleneck?",
        "answer": "A project bottleneck is a point in execution where work repeatedly accumulates, waits or cycles because capacity, decisions, dependencies or handoffs cannot keep pace with the flow of work."
      },
      {
        "question": "Is every late task a bottleneck?",
        "answer": "No. A late task may be an isolated exception. A bottleneck is better supported when a recurring flow constraint creates waiting, queues, rework or downstream exposure."
      },
      {
        "question": "Can AI detect bottlenecks automatically?",
        "answer": "AI can surface candidate bottleneck patterns from event history, but material conclusions should remain traceable to evidence and reviewed in project context."
      },
      {
        "question": "What data is useful for bottleneck detection?",
        "answer": "Timestamped task history, planned and actual dates, status changes, blockers, dependencies, decisions, approvals, reopens, milestones and other execution events are useful inputs."
      },
      {
        "question": "How does ProjectOps360 approach bottleneck detection?",
        "answer": "ProjectOps360 uses Process Mining to reconstruct observed execution, Friction Radar to surface evidence-backed friction, and the Living Graph to show downstream dependency impact."
      }
    ],
    "related": [
      {
        "href": "/how-to-detect-project-friction",
        "label": "How to Detect Project Friction"
      },
      {
        "href": "/project-friction-intelligence",
        "label": "Project Friction Intelligence"
      },
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      }
    ]
  },
  "ai-project-blocker-detection": {
    "eyebrow": "AI · Project Blockers",
    "title": "AI Project Blocker Detection",
    "metaDescription": "Learn how AI project blocker detection can surface recurring blockers, waiting, decision latency and dependency exposure while keeping evidence and human review visible.",
    "hero": "Detect blocker patterns from execution evidence instead of waiting for the next status meeting to surface them manually.",
    "answerTitle": "How should AI detect project blockers?",
    "answer": "AI project blocker detection should examine timestamped project events for repeated waiting, stalled transitions, unresolved dependencies, reopen patterns and decision latency. It should distinguish a reported blocker from a recurring execution pattern and show the evidence that supports the signal rather than presenting an unexplained alert.",
    "chain": [
      "Project Events",
      "Blocker Pattern",
      "Evidence",
      "Confidence",
      "Dependencies",
      "PM Action"
    ],
    "signalsTitle": "Signals AI can use to surface blocker candidates",
    "signalsIntro": "The strongest blocker signals combine an observable execution pattern with context about what cannot move because of it.",
    "signals": [
      {
        "title": "Stalled transitions",
        "body": "Work remains in the same state significantly longer than the expected execution pattern for comparable items."
      },
      {
        "title": "Repeated blocker labels",
        "body": "The same blocker category or reason appears across multiple tasks, teams or execution cycles."
      },
      {
        "title": "Unresolved predecessor",
        "body": "Ready work remains inactive because a predecessor task, deliverable or external dependency has not cleared."
      },
      {
        "title": "Decision queue",
        "body": "Several activities are waiting on the same approval, governance decision or scope clarification."
      },
      {
        "title": "Reopen after unblock",
        "body": "Work is marked unblocked but repeatedly reopens or falls back into the same constrained state."
      },
      {
        "title": "Cross-project blocker recurrence",
        "body": "The same execution constraint appears across projects, suggesting a portfolio-level rather than local issue."
      }
    ],
    "methodTitle": "A 6-step evidence-based AI blocker workflow",
    "methodIntro": "AI should accelerate detection, but humans remain accountable for confirming context and deciding intervention.",
    "method": [
      {
        "title": "Establish blocker definitions",
        "body": "Define what counts as blocked, waiting, decision-dependent or externally constrained in the project operating model."
      },
      {
        "title": "Collect event evidence",
        "body": "Capture status transitions, blockers, dates, dependencies, comments, decisions and reopens with timestamps."
      },
      {
        "title": "Detect candidate patterns",
        "body": "Surface prolonged waits, repeated reasons and recurring state sequences that indicate a possible blocker."
      },
      {
        "title": "Score evidence confidence",
        "body": "Separate direct observed evidence from inference, and avoid treating missing data as proof that no blocker exists."
      },
      {
        "title": "Trace affected dependencies",
        "body": "Show which tasks and milestones cannot progress while the blocker remains unresolved."
      },
      {
        "title": "Review and close the loop",
        "body": "After intervention, verify from later events whether waiting and recurrence actually declined."
      }
    ],
    "comparisonTitle": "Manual blocker reporting vs. AI-assisted detection",
    "comparisonIntro": "Manual reporting depends on someone noticing and escalating. AI-assisted detection can inspect the execution trail continuously.",
    "comparisonHeaders": [
      "Manual blocker reporting",
      "AI-assisted blocker detection"
    ],
    "comparison": [
      {
        "left": "Blocker appears in status meeting",
        "right": "Candidate blocker appears from execution pattern and evidence"
      },
      {
        "left": "Reason stored as free text",
        "right": "Repeated reasons can be grouped and compared"
      },
      {
        "left": "Impact described manually",
        "right": "Dependencies can show connected downstream exposure"
      },
      {
        "left": "Closed when owner says resolved",
        "right": "Later execution can verify whether the pattern improved"
      }
    ],
    "decisionTitle": "What to evaluate in AI blocker detection",
    "decisionIntro": "The key question is not whether the product uses AI. It is whether the AI is grounded in project evidence.",
    "decisionPoints": [
      {
        "title": "Evidence links",
        "body": "Every important alert should be traceable to events, tasks, milestones or dependencies."
      },
      {
        "title": "Confidence labels",
        "body": "The interface should separate observed facts from inferred explanations and predictions."
      },
      {
        "title": "Recurrence detection",
        "body": "The system should identify patterns across time, not only keyword matches in current status."
      },
      {
        "title": "Human control",
        "body": "Project leaders should be able to challenge, confirm or dismiss signals with context."
      }
    ],
    "faq": [
      {
        "question": "Can AI automatically identify project blockers?",
        "answer": "AI can identify candidate blocker patterns from execution data, but the reliability of the signal depends on the evidence available and the project context."
      },
      {
        "question": "What is the difference between a blocker and a bottleneck?",
        "answer": "A blocker prevents specific work from progressing. A bottleneck is a recurring constraint in flow that causes work to accumulate or wait; a repeated blocker can become a bottleneck."
      },
      {
        "question": "Can AI detect blockers that were never manually logged?",
        "answer": "Potentially, if event history shows repeated waiting, stalled transitions or dependency inactivity, but the result should be presented as an inferred blocker candidate rather than a proven fact."
      },
      {
        "question": "How should blocker confidence be communicated?",
        "answer": "Observed evidence, inferred explanations, predicted impact and unknowns should remain visibly separated so users can understand what the system knows."
      },
      {
        "question": "How does ProjectOps360 detect blocker-related friction?",
        "answer": "ProjectOps360 combines Process Mining, Friction Radar and the Living Graph to reconstruct flow, surface blocker-related friction and show connected downstream impact."
      }
    ],
    "related": [
      {
        "href": "/project-bottleneck-detection-software",
        "label": "Project Bottleneck Detection Software"
      },
      {
        "href": "/how-to-detect-project-friction",
        "label": "How to Detect Project Friction"
      },
      {
        "href": "/ai-pmo-portfolio-risk-management",
        "label": "AI PMO Portfolio Risk Management"
      }
    ]
  },
  "project-delay-root-cause-analysis": {
    "eyebrow": "Project Delays · Root Cause",
    "title": "Project Delay Root Cause Analysis",
    "metaDescription": "Learn how to investigate the root cause of project delays using execution evidence, process flow, dependencies and disciplined separation of facts, inference and causality.",
    "hero": "Move from “what is late?” to “what execution pattern produced the delay, and what evidence supports that explanation?”",
    "answerTitle": "How do you find the root cause of a project delay?",
    "answer": "Project delay root cause analysis starts by reconstructing the sequence of events that preceded the delay, then identifying where waiting, rework, decisions, dependencies or handoffs changed the expected flow. A credible root-cause conclusion must be supported by evidence; sequence or correlation alone should not be presented as proven causality.",
    "chain": [
      "Late Outcome",
      "Event Timeline",
      "Flow Deviation",
      "Candidate Cause",
      "Evidence",
      "Validation"
    ],
    "signalsTitle": "Evidence patterns that support a root-cause investigation",
    "signalsIntro": "These patterns narrow the investigation. They do not automatically prove causality.",
    "signals": [
      {
        "title": "Predecessor delay",
        "body": "A dependent task starts late after a predecessor repeatedly misses expected completion or handoff timing."
      },
      {
        "title": "Waiting concentration",
        "body": "A large share of elapsed time accumulates in one approval, queue, environment, vendor or functional handoff."
      },
      {
        "title": "Rework before slippage",
        "body": "Repeated reopen or correction cycles consume execution time before schedule variance appears."
      },
      {
        "title": "Decision latency",
        "body": "A milestone loses margin while unresolved decisions prevent connected work from advancing."
      },
      {
        "title": "Scope or sequence deviation",
        "body": "Observed work departs from the expected execution path through added steps, skipped gates or reordered activities."
      },
      {
        "title": "Recurring causal candidate",
        "body": "The same pattern precedes similar delays across multiple tasks, phases or projects and warrants deeper validation."
      }
    ],
    "methodTitle": "A 7-step project delay root-cause method",
    "methodIntro": "Root-cause analysis should preserve a chain from outcome to evidence instead of jumping from a late date to an assumed explanation.",
    "method": [
      {
        "title": "Define the delayed outcome",
        "body": "Specify the task, milestone or deliverable that missed its expected timing and quantify the observed variance."
      },
      {
        "title": "Build the event timeline",
        "body": "Collect timestamped changes, blockers, decisions, dependencies, rework and handoffs leading up to the delay."
      },
      {
        "title": "Compare expected and observed flow",
        "body": "Identify where sequence, cycle time or handoff behavior diverged from the planned execution model."
      },
      {
        "title": "Generate candidate explanations",
        "body": "List plausible contributors such as waiting, rework, capacity, decisions, dependency failure or scope change."
      },
      {
        "title": "Link each candidate to evidence",
        "body": "Separate directly observed facts from inference and note where evidence is incomplete."
      },
      {
        "title": "Test alternative explanations",
        "body": "Check whether the delay can be explained by another factor or whether the pattern recurs in comparable work."
      },
      {
        "title": "Intervene and verify",
        "body": "Apply a corrective action and observe whether the same delay-producing pattern declines in later execution."
      }
    ],
    "comparisonTitle": "Delay reporting vs. root-cause analysis",
    "comparisonIntro": "Variance tells you the result. Root-cause analysis explains the path that produced it.",
    "comparisonHeaders": [
      "Delay reporting",
      "Root-cause analysis"
    ],
    "comparison": [
      {
        "left": "Milestone slipped 12 days",
        "right": "Which execution events consumed the 12 days?"
      },
      {
        "left": "Dependency was late",
        "right": "Why was the dependency late and how did waiting propagate?"
      },
      {
        "left": "Team reported rework",
        "right": "Which reopen cycles occurred and when did they affect schedule margin?"
      },
      {
        "left": "Cause marked as vendor",
        "right": "What traceable evidence supports that causal conclusion?"
      }
    ],
    "decisionTitle": "What to evaluate in root-cause analysis software",
    "decisionIntro": "Software should make causal discipline easier, not convert correlations into confident-sounding answers.",
    "decisionPoints": [
      {
        "title": "Timeline reconstruction",
        "body": "Can you inspect the full sequence of events before the delay?"
      },
      {
        "title": "Expected vs. observed flow",
        "body": "Can the system show where execution departed from the intended path?"
      },
      {
        "title": "Evidence classification",
        "body": "Can it distinguish observed facts, inference, prediction and unknowns?"
      },
      {
        "title": "Dependency propagation",
        "body": "Can it show how the original delay affected downstream work?"
      }
    ],
    "faq": [
      {
        "question": "What is root cause analysis in project management?",
        "answer": "It is the disciplined investigation of the underlying execution conditions that produced an undesirable project outcome such as delay, rework or missed milestones."
      },
      {
        "question": "Can process mining help find project delay root causes?",
        "answer": "Process mining can reconstruct observed execution and reveal recurring waits, loops and deviations that support root-cause investigation, but causality still requires evidence and validation."
      },
      {
        "question": "Is the longest delayed task always the root cause?",
        "answer": "No. The visible late task may be downstream of an earlier dependency, decision, rework loop or handoff problem."
      },
      {
        "question": "Can AI prove the root cause automatically?",
        "answer": "AI can rank plausible explanations and organize evidence, but high-impact causal conclusions should not be treated as proven without appropriate validation."
      },
      {
        "question": "How does ProjectOps360 support root-cause analysis?",
        "answer": "ProjectOps360 reconstructs observed flow with Process Mining, surfaces friction evidence with Friction Radar and uses the Living Graph to trace downstream dependency impact."
      }
    ],
    "related": [
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      },
      {
        "href": "/project-friction-intelligence",
        "label": "Project Friction Intelligence"
      },
      {
        "href": "/planned-vs-actual-project-execution",
        "label": "Planned vs Actual Project Execution"
      }
    ]
  },
  "project-dependency-impact-analysis": {
    "eyebrow": "Dependencies · Downstream Impact",
    "title": "Project Dependency Impact Analysis",
    "metaDescription": "Learn how project dependency impact analysis traces delayed or blocked work to downstream tasks, milestones and workstreams so teams can prioritize by actual exposure.",
    "hero": "See what a dependency problem can affect next — not just that the dependency exists.",
    "answerTitle": "What is project dependency impact analysis?",
    "answer": "Project dependency impact analysis evaluates how a delayed, blocked or changing work item connects to downstream tasks, milestones and workstreams. Instead of treating every dependency as equally important, it examines execution state, schedule margin, path depth and connected work to estimate where intervention has the most leverage.",
    "chain": [
      "Dependency",
      "Current State",
      "Connected Work",
      "Schedule Margin",
      "Exposure",
      "Priority"
    ],
    "signalsTitle": "Dependency signals that indicate rising downstream exposure",
    "signalsIntro": "A dependency becomes operationally important when connected work is ready, schedule margin is shrinking or multiple paths converge on the same predecessor.",
    "signals": [
      {
        "title": "Ready-but-waiting successors",
        "body": "Downstream work is otherwise ready to start but remains inactive because a predecessor has not cleared."
      },
      {
        "title": "Low schedule margin",
        "body": "The gap between expected predecessor completion and successor need date is shrinking or already negative."
      },
      {
        "title": "High fan-out",
        "body": "One predecessor feeds many downstream tasks, milestones or workstreams, increasing potential blast radius."
      },
      {
        "title": "Critical sequence convergence",
        "body": "Several important paths depend on the same decision, deliverable, environment or integration."
      },
      {
        "title": "Cross-project dependency",
        "body": "A delay in one project can affect another project or portfolio milestone through a shared dependency."
      },
      {
        "title": "Repeated dependency churn",
        "body": "Dependency dates or ownership repeatedly change, creating uncertainty and re-planning across connected work."
      }
    ],
    "methodTitle": "A 6-step dependency impact analysis",
    "methodIntro": "Prioritize dependencies based on observed exposure and connected execution, not on a static list alone.",
    "method": [
      {
        "title": "Identify the dependency object",
        "body": "Specify the predecessor, decision, deliverable, resource or external condition that connected work depends on."
      },
      {
        "title": "Map direct successors",
        "body": "List the tasks and milestones immediately dependent on the object and their current execution state."
      },
      {
        "title": "Expand downstream paths",
        "body": "Trace additional work connected beyond the first level to understand propagation depth."
      },
      {
        "title": "Measure timing exposure",
        "body": "Compare predecessor forecast, successor need dates and available schedule margin."
      },
      {
        "title": "Prioritize by blast radius",
        "body": "Combine connected work, milestone importance, current waiting and evidence confidence to focus attention."
      },
      {
        "title": "Recalculate after change",
        "body": "When the dependency moves or resolves, refresh downstream exposure rather than relying on an old snapshot."
      }
    ],
    "comparisonTitle": "Dependency register vs. dependency impact intelligence",
    "comparisonIntro": "A register records relationships. Impact analysis explains current exposure created by those relationships.",
    "comparisonHeaders": [
      "Dependency register",
      "Impact analysis"
    ],
    "comparison": [
      {
        "left": "A depends on B",
        "right": "Which work is waiting because B has not cleared?"
      },
      {
        "left": "Due date recorded",
        "right": "How much schedule margin remains before successors are affected?"
      },
      {
        "left": "Owner assigned",
        "right": "What milestones and workstreams are within the blast radius?"
      },
      {
        "left": "Dependency closed",
        "right": "Did downstream work actually resume after closure?"
      }
    ],
    "decisionTitle": "What to evaluate in dependency analysis software",
    "decisionIntro": "Strong dependency intelligence combines graph structure with live execution state.",
    "decisionPoints": [
      {
        "title": "Graph depth",
        "body": "Can the system trace more than one level of downstream dependency?"
      },
      {
        "title": "Execution state",
        "body": "Does exposure account for whether successors are actually ready or waiting?"
      },
      {
        "title": "Schedule context",
        "body": "Can it show remaining margin rather than only due dates?"
      },
      {
        "title": "Evidence and confidence",
        "body": "Can users see why a dependency was ranked as material?"
      }
    ],
    "faq": [
      {
        "question": "What is downstream impact in project management?",
        "answer": "Downstream impact is the effect that a change, delay or blocker in one work item may have on tasks, milestones or workstreams that depend on it."
      },
      {
        "question": "Are all dependencies equally risky?",
        "answer": "No. Risk depends on current execution state, schedule margin, number and importance of connected successors, and the likelihood that the dependency will not clear in time."
      },
      {
        "question": "What is dependency blast radius?",
        "answer": "Blast radius describes how much connected work may be exposed if a dependency fails, slips or changes."
      },
      {
        "question": "Can a dependency be closed but still have impact?",
        "answer": "Yes. A predecessor may be marked complete while downstream teams still require rework, validation or recovery time before execution resumes."
      },
      {
        "question": "How does the Living Graph help dependency analysis?",
        "answer": "ProjectOps360's Living Graph connects tasks, milestones and dependencies so a friction or delay signal can be viewed in the context of connected downstream work."
      }
    ],
    "related": [
      {
        "href": "/project-friction-intelligence",
        "label": "Project Friction Intelligence"
      },
      {
        "href": "/ai-pmo-portfolio-risk-management",
        "label": "AI PMO Portfolio Risk Management"
      },
      {
        "href": "/sap-transformation-project-intelligence",
        "label": "SAP Transformation Project Intelligence"
      }
    ]
  },
  "project-rework-detection": {
    "eyebrow": "Rework · Execution Intelligence",
    "title": "Project Rework Detection",
    "metaDescription": "Learn how to detect project rework from reopen cycles, backward transitions, repeated reviews and correction loops, and how to distinguish healthy iteration from execution friction.",
    "hero": "Detect when iteration stops being productive learning and starts consuming execution capacity through repeated correction loops.",
    "answerTitle": "How can project rework be detected automatically?",
    "answer": "Project rework can be detected from execution history when completed or reviewed work repeatedly reopens, moves backward to prior states, returns through the same approval path or requires repeated correction before advancing. Detection should account for project context because not every iteration is waste; the goal is to identify recurring loops that materially consume time or create downstream delay.",
    "chain": [
      "Execution History",
      "Backward Transition",
      "Repeat Cycle",
      "Time Cost",
      "Dependencies",
      "Intervention"
    ],
    "signalsTitle": "Execution patterns that can indicate rework",
    "signalsIntro": "Rework is strongest when the same work repeatedly crosses a completion or review boundary without producing durable progress.",
    "signals": [
      {
        "title": "Reopen after completion",
        "body": "Tasks repeatedly move from completed or approved states back into active work."
      },
      {
        "title": "Backward status transitions",
        "body": "Items return to earlier workflow stages after review, testing or validation."
      },
      {
        "title": "Repeated review cycles",
        "body": "The same deliverable requires multiple review-and-correct loops beyond the expected operating pattern."
      },
      {
        "title": "Defect retest recurrence",
        "body": "Defects repeatedly fail validation or reappear after remediation, increasing cycle time."
      },
      {
        "title": "Duplicate effort entries",
        "body": "Additional effort accumulates on work that was already considered complete or accepted."
      },
      {
        "title": "Downstream reset",
        "body": "Rework on a predecessor forces connected tasks to pause, revise or repeat their own work."
      }
    ],
    "methodTitle": "A 6-step rework detection method",
    "methodIntro": "The objective is to quantify recurring execution loops and their impact without labeling normal iteration as failure.",
    "method": [
      {
        "title": "Define expected iteration",
        "body": "Establish which review, test and revision cycles are normal for the type of work being analyzed."
      },
      {
        "title": "Reconstruct state history",
        "body": "Sequence task transitions, approvals, defects, reopens and completion events."
      },
      {
        "title": "Detect repeated loops",
        "body": "Find backward transitions or repeated state sequences that occur more often than the expected pattern."
      },
      {
        "title": "Measure rework cost",
        "body": "Quantify elapsed time, additional effort and milestone margin consumed by the repeated cycles."
      },
      {
        "title": "Trace downstream effects",
        "body": "Identify dependent work that paused, changed or repeated because of the rework."
      },
      {
        "title": "Verify after intervention",
        "body": "Change the upstream quality, review or decision mechanism and measure whether loop frequency declines."
      }
    ],
    "comparisonTitle": "Iteration vs. execution rework",
    "comparisonIntro": "Not every revision is harmful. The distinction is whether the cycle is expected and whether it creates material execution friction.",
    "comparisonHeaders": [
      "Healthy iteration",
      "Execution rework"
    ],
    "comparison": [
      {
        "left": "Planned review cycle",
        "right": "Unexpected repeated reopen after acceptance"
      },
      {
        "left": "Learning produces forward progress",
        "right": "Same issue repeatedly returns through prior states"
      },
      {
        "left": "Iteration budgeted in plan",
        "right": "Unplanned effort erodes schedule or capacity"
      },
      {
        "left": "Downstream work remains stable",
        "right": "Connected work must pause, revise or repeat"
      }
    ],
    "decisionTitle": "What to evaluate in rework detection software",
    "decisionIntro": "Look for event-level detection rather than relying only on users tagging an item as rework.",
    "decisionPoints": [
      {
        "title": "State history",
        "body": "Can the platform inspect every status transition and reopen event?"
      },
      {
        "title": "Loop detection",
        "body": "Can it recognize recurring sequences instead of isolated changes?"
      },
      {
        "title": "Effort and time impact",
        "body": "Can it estimate additional elapsed time or effort associated with loops?"
      },
      {
        "title": "Dependency effects",
        "body": "Can it show downstream work affected by upstream rework?"
      }
    ],
    "faq": [
      {
        "question": "What is rework in project management?",
        "answer": "Rework is repeated effort required to correct, redo or revalidate work that had already progressed through a prior execution or acceptance stage."
      },
      {
        "question": "Is iteration the same as rework?",
        "answer": "No. Planned iteration can be productive. Rework is more concerning when repeated loops are unexpected, consume material capacity or cause downstream disruption."
      },
      {
        "question": "Can process mining detect rework?",
        "answer": "Yes. Process mining can reveal repeated state sequences, backward transitions and loops in event history that support rework analysis."
      },
      {
        "question": "What causes project rework?",
        "answer": "Possible contributors include unclear requirements, quality defects, premature handoffs, decision changes, dependency changes and incomplete acceptance criteria. Evidence is needed before assigning a root cause."
      },
      {
        "question": "How does ProjectOps360 surface rework?",
        "answer": "ProjectOps360 uses Process Mining to reconstruct repeated execution paths, Friction Radar to identify rework-related friction and the Living Graph to show connected downstream impact."
      }
    ],
    "related": [
      {
        "href": "/project-delay-root-cause-analysis",
        "label": "Project Delay Root Cause Analysis"
      },
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      },
      {
        "href": "/how-to-detect-project-friction",
        "label": "How to Detect Project Friction"
      }
    ]
  },
  "project-execution-intelligence-software": {
    "eyebrow": "Category · Project Execution Intelligence",
    "title": "Project Execution Intelligence Software",
    "metaDescription": "Learn what project execution intelligence software is, how it differs from task tracking, and which capabilities matter for process mining, friction detection and dependency impact.",
    "hero": "Go beyond recording project status. Understand how work actually moves, where execution is degrading and what the problem can affect next.",
    "answerTitle": "What is project execution intelligence software?",
    "answer": "Project execution intelligence software analyzes project event history, workflow behavior and dependency relationships to explain how work is actually executing. Unlike task tracking alone, it focuses on observed flow, recurring friction, evidence and downstream impact so project and PMO leaders can investigate why execution is changing, not only see the latest status.",
    "chain": [
      "Project Data",
      "Event History",
      "Observed Flow",
      "Friction",
      "Dependencies",
      "Decision Intelligence"
    ],
    "signalsTitle": "Capabilities that distinguish execution intelligence from tracking",
    "signalsIntro": "Execution intelligence is not defined by a dashboard or an AI chat box. It depends on what the system can reconstruct and explain from project evidence.",
    "signals": [
      {
        "title": "Event-level history",
        "body": "The system preserves how tasks, milestones, decisions and dependencies changed over time."
      },
      {
        "title": "Observed flow reconstruction",
        "body": "It can show the sequence work actually followed rather than only the planned workflow."
      },
      {
        "title": "Friction detection",
        "body": "It surfaces recurring waiting, blockers, rework, handoff delays and schedule divergence."
      },
      {
        "title": "Dependency intelligence",
        "body": "It connects execution problems to tasks and milestones that may be affected downstream."
      },
      {
        "title": "Evidence traceability",
        "body": "Important findings remain linked to the underlying project records that support them."
      },
      {
        "title": "Portfolio pattern detection",
        "body": "PMO leaders can see recurring execution problems across multiple projects, not only within one plan."
      }
    ],
    "methodTitle": "How execution intelligence turns project data into decisions",
    "methodIntro": "The operating chain moves from raw history to observed flow, evidence-backed signals and connected impact.",
    "method": [
      {
        "title": "Capture project events",
        "body": "Record task changes, dates, milestones, dependencies, decisions, blockers and other execution evidence."
      },
      {
        "title": "Build the observed execution model",
        "body": "Sequence events to reconstruct how work actually moved through the project."
      },
      {
        "title": "Compare with expectations",
        "body": "Identify waiting, loops, deviations and timing differences relative to the intended plan."
      },
      {
        "title": "Surface material friction",
        "body": "Rank recurring signals by severity, persistence and evidence confidence."
      },
      {
        "title": "Connect downstream impact",
        "body": "Use dependency relationships to understand which tasks and milestones are exposed."
      },
      {
        "title": "Support intervention and learning",
        "body": "After action is taken, remeasure the execution pattern and preserve the result as organizational evidence."
      }
    ],
    "comparisonTitle": "Project management software vs. project execution intelligence",
    "comparisonIntro": "The categories overlap, but their primary questions are different.",
    "comparisonHeaders": [
      "Traditional project management",
      "Project execution intelligence"
    ],
    "comparison": [
      {
        "left": "What is assigned and when is it due?",
        "right": "How is work actually moving?"
      },
      {
        "left": "Which tasks are late?",
        "right": "What friction pattern is producing the delay?"
      },
      {
        "left": "What dependencies are listed?",
        "right": "Which dependencies are creating current downstream exposure?"
      },
      {
        "left": "What is the current status?",
        "right": "How did execution arrive at the current condition?"
      }
    ],
    "decisionTitle": "What to evaluate in project execution intelligence software",
    "decisionIntro": "A strong platform should be useful even before predictive AI is added because its core value comes from trustworthy execution evidence.",
    "decisionPoints": [
      {
        "title": "Process intelligence",
        "body": "Can it reconstruct actual execution and compare it with expected flow?"
      },
      {
        "title": "Friction evidence",
        "body": "Can users inspect the events behind a detected problem?"
      },
      {
        "title": "Living dependencies",
        "body": "Does dependency impact reflect current execution state rather than a static diagram?"
      },
      {
        "title": "Governance",
        "body": "Are observed facts, inference, predictions and unknowns clearly distinguished?"
      }
    ],
    "faq": [
      {
        "question": "What is project execution intelligence?",
        "answer": "Project execution intelligence is the practice of using project event history, flow analysis and dependency context to understand how work is actually executing and where intervention may be needed."
      },
      {
        "question": "How is it different from project management software?",
        "answer": "Traditional project management software primarily plans and tracks work. Execution intelligence adds analysis of actual flow, recurring friction, evidence and downstream impact."
      },
      {
        "question": "Does project execution intelligence replace project managers?",
        "answer": "No. It supports project and PMO decision-making by making execution patterns and evidence easier to inspect; accountable humans still make decisions."
      },
      {
        "question": "Is AI required for project execution intelligence?",
        "answer": "No. Event history, process analysis and dependency graphs can provide execution intelligence without generative AI. AI can accelerate synthesis and pattern detection when grounded in the evidence."
      },
      {
        "question": "How does ProjectOps360 define its execution intelligence model?",
        "answer": "ProjectOps360 connects Process Mining, Friction Radar and the Living Graph to move from observed execution to friction evidence and downstream dependency impact."
      }
    ],
    "related": [
      {
        "href": "/project-friction-intelligence",
        "label": "Project Friction Intelligence"
      },
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      },
      {
        "href": "/planned-vs-actual-project-execution",
        "label": "Planned vs Actual Project Execution"
      }
    ]
  },
  "transformation-management-office-software": {
    "eyebrow": "TMO · Transformation Management Office",
    "title": "Transformation Management Office Software",
    "metaDescription": "Learn what transformation management office software should provide for cross-workstream execution, dependencies, portfolio risk, evidence and transformation decision intelligence.",
    "hero": "Give a Transformation Management Office visibility into how work is executing across initiatives — not only whether each workstream reports green, yellow or red.",
    "answerTitle": "What should Transformation Management Office software do?",
    "answer": "Transformation Management Office software should connect strategic initiatives, milestones, workstreams, decisions and dependencies while preserving the execution history behind reported status. For complex transformations, the TMO needs to identify recurring friction, cross-workstream exposure and patterns that can threaten outcomes before they appear as isolated red milestones.",
    "chain": [
      "Initiatives",
      "Workstream Events",
      "Execution Patterns",
      "Portfolio Friction",
      "Dependencies",
      "TMO Decisions"
    ],
    "signalsTitle": "Signals a TMO should be able to see across workstreams",
    "signalsIntro": "Transformation risk often develops between workstreams, where ownership and reporting boundaries hide shared execution constraints.",
    "signals": [
      {
        "title": "Cross-workstream dependency waiting",
        "body": "Multiple initiatives are waiting on shared decisions, capabilities, data, technology or predecessor deliverables."
      },
      {
        "title": "Recurring governance latency",
        "body": "Strategic decisions or approvals repeatedly exceed expected turnaround and stall connected execution."
      },
      {
        "title": "Systemic rework",
        "body": "Similar correction loops appear across teams, suggesting a transformation-wide operating issue."
      },
      {
        "title": "Milestone convergence risk",
        "body": "Several critical initiatives depend on the same constrained capability or readiness condition."
      },
      {
        "title": "Resource contention evidence",
        "body": "Execution histories show recurring waiting around shared teams or scarce specialist capacity."
      },
      {
        "title": "Portfolio friction recurrence",
        "body": "The same friction pattern appears in multiple projects and becomes a candidate for enterprise-level intervention."
      }
    ],
    "methodTitle": "A 6-step TMO execution-intelligence operating model",
    "methodIntro": "The TMO should connect strategic governance to evidence from actual work instead of aggregating status colors alone.",
    "method": [
      {
        "title": "Define transformation outcomes and execution model",
        "body": "Map initiatives, workstreams, decision gates, strategic milestones and material dependencies."
      },
      {
        "title": "Collect execution evidence",
        "body": "Ingest project events, milestone movement, decisions, blockers, risks, dependencies and readiness signals."
      },
      {
        "title": "Reconstruct workstream flow",
        "body": "Analyze how initiatives are actually progressing, including waits, loops and handoff delays."
      },
      {
        "title": "Identify systemic friction",
        "body": "Look for patterns that recur across teams or projects rather than treating each symptom independently."
      },
      {
        "title": "Trace portfolio exposure",
        "body": "Connect shared dependencies and friction points to strategic milestones and initiatives."
      },
      {
        "title": "Intervene at the right level",
        "body": "Choose project, program or enterprise action based on evidence and remeasure whether the pattern improves."
      }
    ],
    "comparisonTitle": "TMO status aggregation vs. transformation intelligence",
    "comparisonIntro": "A consolidated dashboard can still hide the execution mechanics that create transformation risk.",
    "comparisonHeaders": [
      "Status aggregation",
      "Transformation intelligence"
    ],
    "comparison": [
      {
        "left": "12 initiatives are yellow",
        "right": "Which recurring execution patterns explain the yellow status?"
      },
      {
        "left": "Shared dependency listed",
        "right": "Which initiatives are currently waiting on it?"
      },
      {
        "left": "Risk appears in several projects",
        "right": "Is there a systemic friction pattern across the portfolio?"
      },
      {
        "left": "Mitigation actions are complete",
        "right": "Did execution improve after the intervention?"
      }
    ],
    "decisionTitle": "What to evaluate in TMO software",
    "decisionIntro": "Transformation offices need both portfolio structure and execution evidence.",
    "decisionPoints": [
      {
        "title": "Cross-project visibility",
        "body": "Can the platform compare execution patterns across initiatives and workstreams?"
      },
      {
        "title": "Dependency graph",
        "body": "Can it trace shared dependencies across project boundaries?"
      },
      {
        "title": "Evidence-backed risk",
        "body": "Can leaders inspect the execution evidence behind portfolio signals?"
      },
      {
        "title": "Strategic linkage",
        "body": "Can execution friction be connected to transformation outcomes and milestones?"
      }
    ],
    "faq": [
      {
        "question": "What is a Transformation Management Office?",
        "answer": "A Transformation Management Office coordinates governance, execution, dependencies, outcomes and decision-making across a multi-initiative organizational transformation."
      },
      {
        "question": "How is TMO software different from a PMO dashboard?",
        "answer": "TMO software typically needs stronger cross-initiative linkage to strategic outcomes, transformation workstreams and enterprise dependencies. Execution intelligence adds evidence about how the work is actually moving."
      },
      {
        "question": "What is systemic transformation friction?",
        "answer": "It is a recurring execution constraint that appears across multiple initiatives or workstreams, such as repeated decision latency, handoff delays or shared dependency congestion."
      },
      {
        "question": "Should TMO software use AI?",
        "answer": "AI can help detect and summarize patterns, but portfolio decisions should remain grounded in traceable execution evidence and human governance."
      },
      {
        "question": "How can ProjectOps360 support a TMO?",
        "answer": "ProjectOps360 combines process mining, friction detection, dependency intelligence and PMO portfolio views to connect actual execution with transformation governance."
      }
    ],
    "related": [
      {
        "href": "/ai-pmo-portfolio-risk-management",
        "label": "AI PMO Portfolio Risk Management"
      },
      {
        "href": "/project-execution-intelligence-software",
        "label": "Project Execution Intelligence Software"
      },
      {
        "href": "/sap-transformation-project-intelligence",
        "label": "SAP Transformation Project Intelligence"
      }
    ]
  },
  "pmo-systemic-bottleneck-analysis": {
    "eyebrow": "PMO · Portfolio Patterns",
    "title": "PMO Systemic Bottleneck Analysis",
    "metaDescription": "Learn how a PMO can identify systemic bottlenecks across projects using recurring execution patterns, shared dependencies, waiting, rework and evidence-backed portfolio analysis.",
    "hero": "Find the execution constraints that keep appearing across projects — and intervene once at the systemic level instead of fixing the same symptom repeatedly.",
    "answerTitle": "How can a PMO find systemic bottlenecks across projects?",
    "answer": "A PMO can identify systemic bottlenecks by comparing project event histories and looking for recurring waiting, rework, decision latency, handoff delays and shared dependency congestion across multiple projects. The strongest portfolio finding is not a single red project but a repeated execution pattern supported by evidence in several initiatives.",
    "chain": [
      "Project Events",
      "Local Friction",
      "Pattern Matching",
      "Systemic Signal",
      "Portfolio Exposure",
      "PMO Action"
    ],
    "signalsTitle": "Patterns that suggest a bottleneck is systemic",
    "signalsIntro": "Systemic bottlenecks cross project boundaries and often point to governance, shared capacity or operating-model constraints.",
    "signals": [
      {
        "title": "Repeated decision latency",
        "body": "Different projects wait on the same governance body, approval type or decision process."
      },
      {
        "title": "Shared-team queues",
        "body": "Work from multiple projects accumulates around the same specialist team or shared service."
      },
      {
        "title": "Common rework pattern",
        "body": "Similar reopen or correction loops recur in multiple project types or phases."
      },
      {
        "title": "Recurring handoff friction",
        "body": "Projects repeatedly lose time at the same organizational or vendor boundary."
      },
      {
        "title": "Shared dependency congestion",
        "body": "Several initiatives depend on the same environment, capability, platform or upstream deliverable."
      },
      {
        "title": "Repeated milestone precursor",
        "body": "The same friction signal consistently appears before late milestones across the portfolio."
      }
    ],
    "methodTitle": "A 7-step PMO systemic bottleneck analysis",
    "methodIntro": "Start with comparable event evidence, then escalate only patterns that persist across projects.",
    "method": [
      {
        "title": "Normalize execution events",
        "body": "Create comparable definitions for statuses, blockers, decisions, rework and dependencies across projects."
      },
      {
        "title": "Detect local friction",
        "body": "Identify waiting, loops and constraints within each project before aggregating them."
      },
      {
        "title": "Group similar patterns",
        "body": "Cluster recurring friction by process stage, dependency type, team, decision mechanism or handoff."
      },
      {
        "title": "Measure recurrence",
        "body": "Count how often the pattern appears and whether it is concentrated in particular project classes."
      },
      {
        "title": "Assess portfolio impact",
        "body": "Connect recurring friction to milestones, schedule variance and strategic initiatives."
      },
      {
        "title": "Choose systemic intervention",
        "body": "Address the shared operating constraint rather than assigning separate local mitigations to every project."
      },
      {
        "title": "Remeasure the portfolio",
        "body": "Track whether recurrence and waiting decline after the PMO intervention."
      }
    ],
    "comparisonTitle": "Project issue management vs. systemic bottleneck analysis",
    "comparisonIntro": "Project-level remediation can hide the fact that the same issue is being solved repeatedly.",
    "comparisonHeaders": [
      "Project-level issue view",
      "Systemic PMO view"
    ],
    "comparison": [
      {
        "left": "Project A waits for architecture approval",
        "right": "How many projects wait on the same approval mechanism?"
      },
      {
        "left": "Project B has rework",
        "right": "Does the same rework loop recur across comparable projects?"
      },
      {
        "left": "Project C reports resource constraint",
        "right": "Is one shared team creating queues across the portfolio?"
      },
      {
        "left": "Each project has a mitigation",
        "right": "Would one operating-model change remove the recurring constraint?"
      }
    ],
    "decisionTitle": "What to evaluate in PMO pattern-analysis software",
    "decisionIntro": "Portfolio intelligence requires comparability, recurrence analysis and evidence traceability.",
    "decisionPoints": [
      {
        "title": "Cross-project normalization",
        "body": "Can similar events and friction patterns be compared across projects?"
      },
      {
        "title": "Recurrence metrics",
        "body": "Can the system distinguish isolated exceptions from systemic patterns?"
      },
      {
        "title": "Portfolio dependency context",
        "body": "Can shared dependencies and constrained services be linked across initiatives?"
      },
      {
        "title": "Intervention measurement",
        "body": "Can the PMO verify whether a systemic change reduced recurrence later?"
      }
    ],
    "faq": [
      {
        "question": "What is a systemic project bottleneck?",
        "answer": "It is a recurring execution constraint that affects multiple projects because they share an operating process, governance mechanism, team, dependency or organizational boundary."
      },
      {
        "question": "How is systemic analysis different from portfolio risk reporting?",
        "answer": "Portfolio risk reporting aggregates risk status. Systemic analysis compares execution patterns to find recurring mechanisms that may be producing risk across projects."
      },
      {
        "question": "Can process mining work across multiple projects?",
        "answer": "Yes, when events are normalized sufficiently to compare comparable stages, transitions and patterns while preserving project context."
      },
      {
        "question": "What should a PMO do after finding a systemic bottleneck?",
        "answer": "The PMO should target the shared constraint at the appropriate governance or operating-model level, then measure whether recurrence and waiting decline."
      },
      {
        "question": "How does ProjectOps360 support systemic PMO analysis?",
        "answer": "ProjectOps360 uses project execution events, process mining and friction signals to surface recurring patterns, with dependency context to show portfolio exposure."
      }
    ],
    "related": [
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      },
      {
        "href": "/ai-pmo-portfolio-risk-management",
        "label": "AI PMO Portfolio Risk Management"
      },
      {
        "href": "/project-bottleneck-detection-software",
        "label": "Project Bottleneck Detection Software"
      }
    ]
  },
  "planned-vs-actual-project-execution": {
    "eyebrow": "Conformance · Planned vs Actual",
    "title": "Planned vs Actual Project Execution",
    "metaDescription": "Learn how to compare planned vs actual project execution using event history, flow conformance, schedule divergence, rework and dependency evidence instead of dates alone.",
    "hero": "Compare the project you planned with the execution path that actually happened — including waiting, loops, skipped gates and reordered work.",
    "answerTitle": "How do you compare planned vs actual project execution?",
    "answer": "Planned vs actual project execution analysis compares the intended sequence, timing, handoffs and milestones with the observed event history of the work. The analysis goes beyond planned versus actual dates by showing where execution waited, repeated, skipped a gate, changed sequence or accumulated dependency pressure.",
    "chain": [
      "Planned Flow",
      "Actual Events",
      "Observed Flow",
      "Deviation",
      "Impact",
      "Learning"
    ],
    "signalsTitle": "Execution deviations worth investigating",
    "signalsIntro": "A deviation is not automatically bad. The question is whether it creates friction, risk or useful evidence for improving the operating model.",
    "signals": [
      {
        "title": "Sequence deviation",
        "body": "Work executes in a different order than the baseline or expected process."
      },
      {
        "title": "Skipped gate",
        "body": "A planned review, approval or readiness step is bypassed or occurs after downstream work has already started."
      },
      {
        "title": "Added loop",
        "body": "Observed execution contains rework, repeated review or correction cycles not represented in the plan."
      },
      {
        "title": "Waiting expansion",
        "body": "Elapsed time increases between planned handoffs even when task durations themselves appear reasonable."
      },
      {
        "title": "Schedule divergence",
        "body": "Actual start, finish or milestone timing moves progressively away from baseline expectations."
      },
      {
        "title": "Dependency substitution",
        "body": "Teams use a different predecessor, workaround or sequencing path because the planned dependency is unavailable."
      }
    ],
    "methodTitle": "A 6-step planned-vs-actual execution analysis",
    "methodIntro": "Use conformance as a learning mechanism, not as a simplistic score of whether people followed the plan.",
    "method": [
      {
        "title": "Model the expected flow",
        "body": "Represent the planned sequence, handoffs, gates, dependencies and milestone timing."
      },
      {
        "title": "Build the actual event history",
        "body": "Collect timestamped task, status, decision, blocker, approval and milestone events."
      },
      {
        "title": "Reconstruct observed flow",
        "body": "Sequence events to show what actually happened, including loops and alternative paths."
      },
      {
        "title": "Compare conformance",
        "body": "Identify skipped, added, reordered or delayed transitions relative to the expected model."
      },
      {
        "title": "Assess impact",
        "body": "Determine which deviations created rework, waiting, schedule pressure or downstream dependency exposure."
      },
      {
        "title": "Update the operating model",
        "body": "Decide whether the plan should change, execution should change, or the deviation should remain an accepted variant."
      }
    ],
    "comparisonTitle": "Date variance vs. execution conformance",
    "comparisonIntro": "Date variance measures when. Conformance explains how.",
    "comparisonHeaders": [
      "Planned vs actual dates",
      "Planned vs actual execution"
    ],
    "comparison": [
      {
        "left": "Actual finish is 8 days late",
        "right": "Which waits, loops or sequence changes produced the 8 days?"
      },
      {
        "left": "Task started early",
        "right": "Did it start before a required gate or predecessor was ready?"
      },
      {
        "left": "Milestone moved",
        "right": "Which execution paths and dependencies drove the movement?"
      },
      {
        "left": "Baseline changed",
        "right": "Did the underlying operating pattern improve or only the target date?"
      }
    ],
    "decisionTitle": "What to evaluate in planned-vs-actual analysis software",
    "decisionIntro": "A useful conformance view needs both a baseline model and detailed actual event history.",
    "decisionPoints": [
      {
        "title": "Sequence analysis",
        "body": "Can the platform compare execution order, not only dates?"
      },
      {
        "title": "Variant visibility",
        "body": "Can users see alternative observed paths and recurring deviations?"
      },
      {
        "title": "Impact linkage",
        "body": "Can deviations be connected to waiting, rework and downstream exposure?"
      },
      {
        "title": "Learning loop",
        "body": "Can accepted variants inform future planning instead of remaining hidden exceptions?"
      }
    ],
    "faq": [
      {
        "question": "What is planned vs actual project execution?",
        "answer": "It is the comparison between the intended project flow and the sequence of events that actually occurred during execution."
      },
      {
        "question": "Is this the same as planned vs actual dates?",
        "answer": "No. Date variance is one input. Execution analysis also compares sequence, handoffs, loops, gates, waiting and dependency behavior."
      },
      {
        "question": "What is conformance checking in project management?",
        "answer": "Conformance checking compares an expected process or execution model with observed event data to identify matching paths and deviations."
      },
      {
        "question": "Are deviations always negative?",
        "answer": "No. Some deviations are useful adaptations. Analysis should determine whether a variant improves flow, creates friction or should become part of the future standard process."
      },
      {
        "question": "How does ProjectOps360 compare planned and actual execution?",
        "answer": "ProjectOps360 uses Process Mining to reconstruct observed execution, then uses friction and dependency context to explain which deviations matter operationally."
      }
    ],
    "related": [
      {
        "href": "/process-mining-for-pmo",
        "label": "Process Mining for PMO"
      },
      {
        "href": "/project-delay-root-cause-analysis",
        "label": "Project Delay Root Cause Analysis"
      },
      {
        "href": "/project-execution-intelligence-software",
        "label": "Project Execution Intelligence Software"
      }
    ]
  },
  "sap-transformation-bottleneck-detection": {
    "eyebrow": "SAP Transformation · Bottlenecks",
    "title": "SAP Transformation Bottleneck Detection",
    "metaDescription": "Learn how to detect bottlenecks in SAP transformation programs across testing, data migration, integrations, decisions, dependencies and cutover readiness.",
    "hero": "Find where an SAP transformation is accumulating waiting, rework or dependency pressure across workstreams before it becomes a cutover or milestone crisis.",
    "answerTitle": "How can you detect bottlenecks in an SAP transformation?",
    "answer": "SAP transformation bottleneck detection examines project execution history across workstreams to find recurring queues, waiting, rework, slow decisions and dependency congestion. The objective is to identify where transformation flow is constrained and which testing, data, integration, change or cutover activities may be affected downstream.",
    "chain": [
      "Workstream Events",
      "Waiting & Rework",
      "Bottleneck",
      "Evidence",
      "Cross-Workstream Dependencies",
      "Cutover Exposure"
    ],
    "signalsTitle": "Common SAP transformation bottleneck signals",
    "signalsIntro": "These are execution signals for investigation. They do not by themselves prove the underlying cause.",
    "signals": [
      {
        "title": "Testing queue growth",
        "body": "Test cases, defects or retests accumulate faster than teams can validate and clear them."
      },
      {
        "title": "Data readiness waiting",
        "body": "Dependent build, testing or cutover activities wait on mapping, cleansing, conversion or reconciliation work."
      },
      {
        "title": "Integration concentration",
        "body": "Many workstreams depend on the same interface, external system, environment or technical decision."
      },
      {
        "title": "Business decision latency",
        "body": "Process design or scope decisions remain unresolved while configuration and testing work accumulates waiting."
      },
      {
        "title": "Security and role dependency",
        "body": "Provisioning, role design or approvals delay testing, training or cutover readiness."
      },
      {
        "title": "Cutover predecessor congestion",
        "body": "Multiple critical cutover tasks converge on unresolved predecessors with diminishing schedule margin."
      }
    ],
    "methodTitle": "A 7-step SAP bottleneck detection method",
    "methodIntro": "Analyze transformation execution as connected workstreams rather than isolated status reports.",
    "method": [
      {
        "title": "Map expected workstream flow",
        "body": "Define major SAP transformation stages, handoffs, decision gates, milestones and cross-workstream dependencies."
      },
      {
        "title": "Collect execution events",
        "body": "Use task history, defects, decisions, approvals, dependencies, readiness records and milestone changes."
      },
      {
        "title": "Measure waiting and loops",
        "body": "Find where work queues, stalls, reopens or repeatedly returns through validation cycles."
      },
      {
        "title": "Confirm recurring constraints",
        "body": "Separate local exceptions from persistent patterns that repeatedly restrict transformation throughput."
      },
      {
        "title": "Trace cross-workstream exposure",
        "body": "Connect each bottleneck to testing, data, integration, change, security and cutover activities that depend on it."
      },
      {
        "title": "Prioritize by milestone and cutover impact",
        "body": "Rank bottlenecks using evidence confidence, persistence, schedule margin and dependency blast radius."
      },
      {
        "title": "Intervene and remeasure",
        "body": "After action, verify whether the bottleneck's queue, waiting or recurrence actually declines."
      }
    ],
    "comparisonTitle": "SAP program status vs. bottleneck intelligence",
    "comparisonIntro": "Program status shows which area is behind. Bottleneck intelligence investigates the flow constraint creating the delay.",
    "comparisonHeaders": [
      "SAP status view",
      "Bottleneck intelligence"
    ],
    "comparison": [
      {
        "left": "SIT is red",
        "right": "Where are defects, retests or dependencies accumulating?"
      },
      {
        "left": "Data migration is yellow",
        "right": "Which readiness step is constraining connected work?"
      },
      {
        "left": "Integration milestone slipped",
        "right": "Is one interface or shared environment creating a queue?"
      },
      {
        "left": "Cutover risk increased",
        "right": "Which predecessor constraints are reducing margin across critical tasks?"
      }
    ],
    "decisionTitle": "What to evaluate in SAP transformation bottleneck software",
    "decisionIntro": "The platform does not need direct SAP application access to begin; it does need reliable project execution evidence.",
    "decisionPoints": [
      {
        "title": "Cross-workstream model",
        "body": "Can the system connect testing, data, integrations, change and cutover execution?"
      },
      {
        "title": "Event evidence",
        "body": "Can it trace bottleneck findings to timestamped project records?"
      },
      {
        "title": "Rework detection",
        "body": "Can it identify defect, retest and approval loops from actual history?"
      },
      {
        "title": "Cutover blast radius",
        "body": "Can it show which critical milestones and predecessors are exposed downstream?"
      }
    ],
    "faq": [
      {
        "question": "What is an SAP transformation bottleneck?",
        "answer": "It is a recurring execution constraint that causes work to accumulate, wait or repeat across an SAP transformation workstream or shared dependency."
      },
      {
        "question": "Where do SAP transformation bottlenecks commonly appear?",
        "answer": "They can appear around testing and defect resolution, data readiness, integrations, decisions, environments, security and roles, change readiness, or cutover predecessors."
      },
      {
        "question": "Does bottleneck detection require direct access to SAP software?",
        "answer": "Not necessarily. It can begin with project execution evidence such as schedules, tasks, defects, milestones, dependencies, decisions and readiness records."
      },
      {
        "question": "Can AI predict SAP bottlenecks?",
        "answer": "AI can surface leading patterns and candidate exposure, but predictions should remain labeled as predictions and grounded in traceable evidence."
      },
      {
        "question": "How does ProjectOps360 approach SAP bottleneck detection?",
        "answer": "ProjectOps360 combines Process Mining, Friction Radar and the Living Graph to reconstruct execution, detect friction patterns and trace cross-workstream downstream impact."
      }
    ],
    "related": [
      {
        "href": "/sap-transformation-project-intelligence",
        "label": "SAP Transformation Project Intelligence"
      },
      {
        "href": "/project-bottleneck-detection-software",
        "label": "Project Bottleneck Detection Software"
      },
      {
        "href": "/project-dependency-impact-analysis",
        "label": "Project Dependency Impact Analysis"
      }
    ],
    "disclaimer": "ProjectOps360 is an independent product and is not affiliated with or endorsed by SAP SE."
  }
} satisfies Record<string, BuyerIntentPageConfig>;

export type BuyerIntentSlug = keyof typeof buyerIntentPages;
