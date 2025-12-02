import React from "react";
import { translateRule } from "@guido/core";
import IconWithTooltip from "./shared/FancyIcon";
import AddOrEditRuleModal from "./AddRuleModal";
import { Rule } from "@guido/types";
import { useAppContext } from "@/hooks/useAppContext";

interface RuleItemProps {
  rule: Rule;
  index: number;
  onDeleteRule: (index: number) => void;
}

const RuleItem: React.FC<RuleItemProps> = ({ rule, index, onDeleteRule }) => {
  const [showModal, setShowModal] = React.useState(false);
  const [newRule, setNewRule] = React.useState<Rule>(rule);
  const { isExpertMode } = useAppContext();

  const onEditRule = () => {
    setShowModal(true);
  };

  return (
    <>
      <div className="p-4 bg-surface-2 rounded-default shadow-md mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h3 className="text-lg font-semibold mb-2 sm:mb-0 text-text-primary">Rule {index + 1}</h3>
          <div className="bg-surface-3 p-4 rounded-default shadow-inner w-full sm:max-w-3xl mb-2 sm:mb-0">
            <p className="text-l text-text-secondary">{translateRule(rule)}</p>
          </div>
          {isExpertMode && (
            <div className="flex items-center">
              <IconWithTooltip
                text="Click to edit this rule"
                icon="✏️"
                onClick={() => onEditRule()}
                className="ml-2 cursor-pointer"
              />
              <IconWithTooltip
                text="Click to delete this rule"
                icon="🗑️"
                onClick={() => onDeleteRule(index)}
                className="ml-2 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
      {showModal && (
        <AddOrEditRuleModal
          newRule={newRule}
          edit={true}
          handleClose={() => setShowModal(false)}
          setNewRule={setNewRule}
          index={index}
        />
      )}
    </>
  );
};

export default RuleItem;