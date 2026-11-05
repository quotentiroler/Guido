import React, { useState } from "react";
import Button from "@/components/shared/Button";
import RuleDomainItem from "@/components/AddRuleDomainItem";
import { useRuleContext } from "@/hooks/useRuleContext";
import AddRequiredModal from "./RequiredFieldsModal";
import ModalShell from "./ModalShell";
import { useTemplateContext } from "@/hooks/useTemplateContext";
import { type Rule, type RuleDomain } from "@quotentiroler/guido-types";
import { createEmptyRule, createEmptyRuleDomain } from "@/utils/drafts";

interface AddRuleModalProps {
  edit?: boolean;
  index?: number;
  newRule: Rule;
  setNewRule: React.Dispatch<React.SetStateAction<Rule>>;
  handleClose: () => void;
}

type DomainList = "conditions" | "targets";

const negateDomains = (domains: RuleDomain[]) => domains.map((domain) => ({ ...domain, not: !domain.not }));

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

  const updateDomains = (list: DomainList, update: (domains: RuleDomain[]) => RuleDomain[]) => {
    setNewRule({ ...newRule, [list]: update(newRule[list] ?? []) });
  };

  const addDomain = (list: DomainList) => updateDomains(list, (domains) => [createEmptyRuleDomain(), ...domains]);

  const removeDomain = (list: DomainList) => (domainIndex: number) =>
    updateDomains(list, (domains) => domains.filter((_, i) => i !== domainIndex));

  const changeDomain = (list: DomainList) => (domainIndex: number, updated: RuleDomain) =>
    updateDomains(list, (domains) => domains.map((domain, i) => (i === domainIndex ? updated : domain)));

  const closeAndReset = () => {
    handleClose();
    setNewRule(createEmptyRule());
  };

  const handleSaveRule = () => {
    handleAddOrEditRule(newRule, edit ? index : undefined, edit ? handleClose : closeAndReset);
  };

  const handleAddContrapositive = () => {
    const contrapositiveRule: Rule = {
      ...newRule,
      conditions: negateDomains(newRule.conditions ?? []),
      targets: negateDomains(newRule.targets),
    };
    if (edit) {
      handleAddOrEditRule(contrapositiveRule, undefined, handleClose);
    } else {
      handleAddOrEditRule(contrapositiveRule, undefined, () => {
        handleAddOrEditRule(newRule, undefined, closeAndReset);
      });
    }
  };

  return (
    <>
      <ModalShell panelClassName="bg-surface-0 p-6 rounded-default shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto flex flex-col mx-4">
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
            onClick={() => addDomain("conditions")}
            type="secondary-text"
            size="small"
          >
            +
          </Button>
        </div>
        {(newRule.conditions?.length ?? 0) >= 2 && (
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-text-secondary">Match:</span>
            <select
              aria-label="Condition match mode"
              value={newRule.match ?? 'all'}
              onChange={(e) => setNewRule({ ...newRule, match: e.target.value === 'any' ? 'any' : 'all' })}
              className="border rounded-default shadow-sm bg-surface-0 text-text-primary"
            >
              <option value="all">All (AND)</option>
              <option value="any">Any (OR)</option>
            </select>
          </div>
        )}
        <div className="flex-grow overflow-y-auto">
          {(newRule.conditions || []).map((condition, conditionIndex) => (
            <RuleDomainItem
              key={conditionIndex}
              item={condition}
              index={conditionIndex}
              role="condition"
              onChange={changeDomain("conditions")}
              onRemove={removeDomain("conditions")}
            />
          ))}
          {newRule.conditions?.length === 0 && (
            <p className="text-sm text-text-disabled">No conditions.</p>
          )}

          <div className="flex justify-between items-center mt-4">
            <h3 className="text-lg font-semibold mb-2 text-text-primary">Targets (THEN)</h3>
            <Button onClick={() => addDomain("targets")} type="secondary-text" size="small">
              +
            </Button>
          </div>
          {newRule.targets.length === 0 && (
            <p className="text-sm text-text-disabled">
              No targets. Add at least one target
            </p>
          )}
          {newRule.targets.map((target, targetIndex) => (
            <RuleDomainItem
              key={targetIndex}
              item={target}
              index={targetIndex}
              role="target"
              onChange={changeDomain("targets")}
              onRemove={removeDomain("targets")}
            />
          ))}
        </div>
        <div className="flex justify-end mt-8 gap-4">
          <Button
            onClick={edit ? handleClose : closeAndReset}
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
      </ModalShell>
      {showRequiredModal && (
        <AddRequiredModal
          handleClose={handleClose}
          fieldNames={fields.map((field) => field.name)}
        />
      )}
    </>
  );
};

export default AddOrEditRuleModal;
