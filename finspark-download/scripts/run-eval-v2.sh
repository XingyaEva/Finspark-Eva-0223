#!/bin/bash
# Run enhanced 5-dimension evaluation on all 3 test sets

BASE_URL="${FINSPARK_BASE_URL:-https://finspark-financial.pages.dev}"
API="${BASE_URL}/api/rag/enhance"

echo "=== RAG Evaluation Runner (5-Dimension Enhanced) ==="
echo "Base URL: $BASE_URL"
echo ""

# Function to create and run an evaluation
run_eval() {
    local test_set_id=$1
    local test_set_name=$2
    
    echo ">>> Creating evaluation for TestSet#${test_set_id}: ${test_set_name}..."
    
    # Create evaluation task
    local create_resp=$(curl -s -X POST "${API}/evaluations" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"v2-enhanced-5dim-$(date +%Y%m%d-%H%M)-set${test_set_id}\",
            \"testSetId\": ${test_set_id},
            \"config\": {
                \"searchStrategy\": \"hybrid\",
                \"topK\": 5,
                \"minScore\": 0.25,
                \"enableRerank\": false
            }
        }")
    
    local eval_id=$(echo "$create_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('evaluation',{}).get('id',''))" 2>/dev/null)
    
    if [ -z "$eval_id" ] || [ "$eval_id" = "" ]; then
        echo "  ERROR creating evaluation: $create_resp"
        return 1
    fi
    
    echo "  Created evaluation #${eval_id}, starting run..."
    
    # Start the evaluation run
    local run_resp=$(curl -s -X POST "${API}/evaluations/${eval_id}/run" \
        -H "Content-Type: application/json" \
        -d '{"resume": true}')
    
    echo "  Run response: $(echo "$run_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message', d.get('error','unknown')))" 2>/dev/null)"
    
    echo "  Eval ID: $eval_id"
    echo ""
    
    echo "$eval_id"
}

# Create and run evaluations for all 3 test sets
echo "--- Step 1: Creating evaluation tasks ---"
EVAL1=$(run_eval 1 "Factual QA")
EVAL2=$(run_eval 2 "Analytical QA")  
EVAL3=$(run_eval 3 "Comparative QA")

echo ""
echo "=== Evaluation tasks created ==="
echo "Eval IDs: $EVAL1, $EVAL2, $EVAL3"
echo ""
echo "--- Step 2: Monitoring progress ---"

# Monitor progress
for i in $(seq 1 60); do
    sleep 10
    echo ""
    echo "=== Check #${i} ($(date +%H:%M:%S)) ==="
    
    all_done=true
    for eval_id in $EVAL1 $EVAL2 $EVAL3; do
        if [ -n "$eval_id" ] && [ "$eval_id" != "" ]; then
            local_resp=$(curl -s "${API}/evaluations/${eval_id}")
            status=$(echo "$local_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d.get('evaluation',{}); print(f'{e.get(\"status\",\"?\")}: {e.get(\"completed_questions\",0)}/{e.get(\"total_questions\",0)} overall={e.get(\"overall_score\",\"pending\")}')" 2>/dev/null)
            echo "  Eval#${eval_id}: $status"
            
            if echo "$status" | grep -q "running\|pending"; then
                all_done=false
            fi
        fi
    done
    
    if [ "$all_done" = true ]; then
        echo ""
        echo "=== All evaluations completed! ==="
        break
    fi
done

echo ""
echo "--- Step 3: Final Results ---"
for eval_id in $EVAL1 $EVAL2 $EVAL3; do
    if [ -n "$eval_id" ] && [ "$eval_id" != "" ]; then
        echo ""
        echo "=== Eval#${eval_id} Details ==="
        curl -s "${API}/evaluations/${eval_id}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
e = d.get('evaluation', {})
print(f'Name: {e.get(\"name\")}')
print(f'Status: {e.get(\"status\")}')
print(f'Questions: {e.get(\"completed_questions\")}/{e.get(\"total_questions\")}')
print(f'Overall Score: {e.get(\"overall_score\")}')
print(f'Exact Match: {e.get(\"exact_match_score\")}')
print(f'Semantic: {e.get(\"semantic_score\")}')
print(f'Recall: {e.get(\"recall_score\")}')
print(f'Citation: {e.get(\"citation_score\")}')
print(f'Faithfulness: {e.get(\"faithfulness_score\", \"N/A\")}')
print(f'By Type: {e.get(\"scores_by_type\")}')
print(f'By Difficulty: {e.get(\"scores_by_difficulty\")}')
" 2>/dev/null
    fi
done
