# LLM_PROMPT_SPEC

## Schemas (JSON)

### OpsExplanation.v1
```json
{
  "type": "object",
  "required": ["schemaId", "generatedAt", "facts", "interpretations", "advisoryOnly"],
  "properties": {
    "schemaId": { "const": "OpsExplanation.v1" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "advisoryOnly": { "const": true },
    "facts": {
      "type": "array",
      "maxItems": 30,
      "items": {
        "type": "object",
        "required": ["id", "label", "value", "sourceType"],
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "value": { "type": "string" },
          "sourceType": {
            "enum": ["read_model", "ops_state", "decision_log", "audit_log", "system_flags"]
          }
        }
      }
    },
    "interpretations": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["statement", "basedOn", "confidence"],
        "properties": {
          "statement": { "type": "string" },
          "basedOn": { "type": "array", "items": { "type": "string" } },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
```

### NextActionCandidates.v1 (abstract actions only)
```json
{
  "type": "object",
  "required": ["schemaId", "generatedAt", "advisoryOnly", "candidates"],
  "properties": {
    "schemaId": { "const": "NextActionCandidates.v1" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "advisoryOnly": { "const": true },
    "candidates": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["action", "reason", "confidence", "safety"],
        "properties": {
          "action": {
            "enum": ["MONITOR", "REVIEW", "ESCALATE", "DEFER", "NO_ACTION"]
          },
          "reason": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "safety": {
            "type": "object",
            "required": ["status", "reasons"],
            "properties": {
              "status": { "enum": ["OK", "BLOCK"] },
              "reasons": { "type": "array", "items": { "type": "string" } }
            }
          }
        }
      }
    }
  }
}
```

### FAQAnswer.v1 (sourceId citations only)
```json
{
  "type": "object",
  "required": ["schemaId", "generatedAt", "question", "answer", "citations", "advisoryOnly"],
  "properties": {
    "schemaId": { "const": "FAQAnswer.v1" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "advisoryOnly": { "const": true },
    "question": { "type": "string" },
    "answer": { "type": "string" },
    "citations": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["sourceType", "sourceId"],
        "properties": {
          "sourceType": { "enum": ["link_registry", "docs"] },
          "sourceId": { "type": "string" }
        }
      }
    }
  }
}
```

## Action Categories (Abstract)
- MONITOR / REVIEW / ESCALATE / DEFER / NO_ACTION

## Hard Rules
- advisoryOnly must be true.
- Direct URLs are forbidden in outputs.
- Candidates must not contain runbook commands.

## Validation
- Output must pass schema validation.
- Schema mismatch => reject and fallback.
