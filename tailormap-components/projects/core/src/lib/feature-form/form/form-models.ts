import {
  Feature,
  FeaturetypeMetadata,
} from '../../shared/generated';

export interface FormConfigurations {
  config: Record<string, FormConfiguration>;
}

export interface FormConfiguration {
  fields: Attribute[];
  tabs: number;
  name: string;
  treeNodeColumn: string;
  idInTreeNodeColumn?: boolean;
  featureType: string;
  tabConfig: Record<number, string>;
  relation?: FormRelation;
  featuretypeMetadata?: FeaturetypeMetadata;
}

export interface Attribute {
  key: string;
  type: FormFieldType;
  options?: SelectOption[];
  linkedList?: number;
  label?: string;
  column: number;
  tab: number;
  isReadOnly?: boolean;
  mandatory?: boolean;
  valueTrue?: string;
  valueFalse?: string;
  dateFormat?: string;
  multiSelect?: boolean;
}

export interface FeatureAttribute extends Attribute {
  key: string;
  // type: FormFieldType;
  value: string | number | (string | number)[];
}

export enum FormFieldType {
  TEXTFIELD = 'textfield',
  SELECT = 'select',
  HIDDEN = 'hidden',
  DOMAIN = 'domain',
  HYPERLINK = 'hyperlink',
  CHECKBOX = 'checkbox',
  DATE = 'date',
  IMAGE = 'image',
}


export interface SelectOption {
  label: string;
  disabled: boolean;
  val: string | number;
  id: number;
}

export interface FormRelation {
  relatedFeatureType: string;
  relation: RelatedColumn[];
}

export interface RelatedColumn {
  mainFeatureColumn: string;
  relatedFeatureColumn: string;
}

export interface IndexedFeatureAttributes {
  attrs: Map<string, FeatureAttribute>;
}

export interface TabbedField {
  tabId: number;
  label: string;
  columns: TabColumn[];
}

export interface TabColumn {
  columnId: number;
  attributes: Attribute[];
}

export interface DialogData {
  formFeatures: Feature[];
  isBulk: boolean;
  closeAfterSave?: boolean;
  alreadyDirty?: boolean;
}
