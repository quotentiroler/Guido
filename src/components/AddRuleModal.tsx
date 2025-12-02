import React, { useState } from "react";
import Button from "./shared/Button";
import Portal from "./shared/Portal";
import RuleDomainItem from "./AddRuleDomainItem";
import { useRuleContext } from "@/hooks/useRuleContext";
import AddRequiredModal from "./RequiredFieldsModal";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { Rule, RuleState, RuleDomain } from "@guido/types";

interface AddRuleModalProps {
  edit?: boolean;
  index?: number;
  newRule: Rule;
  setNewRule: React.Dispatch<React.SetStateAction<Rule>>;
  handleClose: () => void;
}

const AddOrEditRuleModal: React.FC<AddRuleModalProps> = ({
  edit,
  newRule,
  setNewRule,
  handleClose,
  index,
}) => {
  const { handleAddOrEditRule } = useRuleContext();
  const { fields } = useTemplateContext();
  const [showRequiredModal, setShowRequiredModal] = useState(false);

  const handleAddTarget = () => {
    setNewRule({
      ...newRule,
      targets: [
        { name: "", state: RuleState.Set, not: false },
        ...newRule.targets,
      ],
    });
  };

  const handleRemoveTarget = (index: number) => {
    const updatedTargets = newRule.targets.filter((_, i) => i !== index);
    setNewRule({
      ...newRule,
      targets: updatedTargets,
    });
  };

  const handleTargetChange = (index: number, updatedTarget: RuleDomain) => {
    const updatedTargets = [...newRule.targets];
    updatedTargets[index] = updatedTarget;
    setNewRule({ ...newRule, targets: updatedTargets });
  };

  const handleAddCondition = () => {
    setNewRule({
      ...newRule,
      conditions: [
        { name: "", state: RuleState.Set, not: false },
        ...(newRule.conditions || [])
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    const updatedConditions = (newRule.conditions || []).filter(
      (_, i) => i !== index
    );
    setNewRule({
      ...newRule,
      conditions: updatedConditions,
    });
  };

  const handleConditionChange = (
    index: number,
    updatedCondition: RuleDomain
  ) => {
    const updatedConditions = [...(newRule.conditions || [])];
    updatedConditions[index] = updatedCondition;
    setNewRule({ ...newRule, conditions: updatedConditions });
  };

  const handleSaveRule = () => {
    handleAddOrEditRule(newRule, edit ? index : undefined, () => {
      handleClose();
      if (!edit)
        setNewRule({
          targets: [{ name: "", state: RuleState.Set, not: false }],
        });
    });
  };

  const handleCancelEdit = () => {
    handleClose();
    setNewRule({
      targets: [{ name: "", state: RuleState.Set, not: false }],
    });
  };

  const handleAddContrapositive = () => {
    const contrapositiveRule: Rule = {
      ...newRule,
      conditions: (newRule.conditions ?? []).map((condition) => ({
        ...condition,
        not: !condition.not,
      })),
      targets:
        newRule.targets.map((target) => ({
          ...target,
          not: !target.not,
        })) || [],
    };
    if (edit) {
      handleAddOrEditRule(contrapositiveRule, undefined, () => {
        handleClose();
      });
    } else {
      handleAddOrEditRule(contrapositiveRule, undefined, () => {
        handleAddOrEditRule(newRule, undefined, () => {
          handleClose();
          setNewRule({
            targets: [{ name: "", state: RuleState.Set, not: false }],
          });
        });
      });
    };
  }

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-surface-0 p-6 rounded-default shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto flex flex-col mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary">{edit ? "Edit" : "Add"} Rule</h2>
          <Button
            onClick={() => setShowRequiredModal(true)}
            type="secondary-text"
            size="small"
          >
            Edit Required Fields
          </Button>
        </div>
        <div className="flex justify-between items-center my-4">
          <h3 className="text-lg font-semibold mb-2 text-text-primary">Conditions (IF)</h3>
          <Button
            onClick={handleAddCondition}
            type="secondary-text"
            size="small"
          >
            +
          </Button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {(newRule.conditions || []).map((condition, index) => (
            <RuleDomainItem
              key={index}
              item={condition}
              index={index}
              onChange={handleConditionChange}
              onRemove={handleRemoveCondition}
            />
          ))}
          {newRule.conditions?.length === 0 && (
            <p className="text-sm text-text-disabled">No conditions.</p>
          )}

          <div className="flex justify-between items-center mt-4">
            <h3 className="text-lg font-semibold mb-2 text-text-primary">Targets (THEN)</h3>
            <Button onClick={handleAddTarget} type="secondary-text" size="small">
              +
            </Button>
          </div>
          {newRule.targets.length === 0 && (
            <p className="text-sm text-text-disabled">
              No targets. Add at least one target
            </p>
          )}
          {newRule.targets.map((target, index) => (
            <RuleDomainItem
              key={index}
              item={target}
              index={index}
              onChange={handleTargetChange}
              onRemove={handleRemoveTarget}
            />
          ))}
        </div>
        <div className="flex justify-end mt-8 gap-4">
          <Button
            onClick={edit ? handleClose : handleCancelEdit}
            type="primary-text"
          >
            Cancel
          </Button>
          {newRule.targets.length > 0 &&
            (newRule.conditions?.length ?? 0) > 0 && (
              <Button onClick={handleAddContrapositive} type="secondary-text">
                Add Contrapositive
              </Button>
            )}
          <Button onClick={handleSaveRule}>Save</Button>
        </div>
      </div>
      {showRequiredModal && (
        <AddRequiredModal
          handleClose={handleClose}
          fieldNames={fields.map((field) => field.name)}
        />
      )}
    </div>
    </Portal>
  );
};

export default AddOrEditRuleModal;