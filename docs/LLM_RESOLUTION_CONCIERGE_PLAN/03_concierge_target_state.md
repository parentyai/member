# 03 Concierge Target State

## Product definition

Target state is not “chat bot”.  
Target state is **海外赴任実務コンシェルジュ**:

- answers with enough operational density to move the case forward
- exposes the next action and blockers
- keeps official links and task state visible
- uses LINE surfaces as a practical workflow, not as one long text area

## What one turn must do

One turn must normally do all of the following unless a safety stop overrides it:

1. summarize the user situation at working level
2. give a provisional but useful answer
3. surface the next best action
4. attach the most relevant official or primary source path when available
5. expose task / due / blocker state if known
6. ask at most one clarifying question only if it will unlock specificity

## What one conversation must do

One conversation must:

- reduce ambiguity turn by turn
- move from explanation to action
- externalize hidden work into visible task state
- shift from generic chat to the right surface:
  - text
  - quick reply
  - flex
  - rich menu
  - LIFF
  - MINI App

## What one journey must do

One journey must:

- keep phase and task state aligned
- show upcoming due dates and blockers before the user has to ask
- connect official links, required docs, and task ownership
- hand off sensitive or structured work into LIFF / MINI App instead of overloading chat text

## Relationship model

| Entity | Role in target state |
| --- | --- |
| task | unit of user progress |
| docs | evidence and required submission artifacts |
| deadline | urgency / sequencing control |
| link | official path to verify or act |
| blocker | reason a task cannot advance yet |
| escalation | human or safer surface handoff when chat should stop |

## Definition of “natural”

Naturalness here does not mean casual small talk.  
It means the workflow feels coherent:

- the same concierge is speaking across lanes
- the answer feels immediately usable
- the next move is obvious
- the user is not forced to reverse-engineer commands
- safety is present without hijacking the answer

## Non-goals for target state

- maximizing tone warmth at the cost of operational density
- replacing task surfaces with long chat
- using links as decoration without a reason to open them
- pushing sensitive intake back into chat

