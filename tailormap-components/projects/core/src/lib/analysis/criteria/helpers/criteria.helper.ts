import { CriteriaConditionModel } from '../../models/criteria-condition.model';
import { CriteriaModel } from '../../models/criteria.model';
import { CriteriaGroupModel } from '../../models/criteria-group.model';
import { CriteriaTypeEnum } from '../../models/criteria-type.enum';
import { IdService } from '../../../shared/id-service/id.service';
import { CriteriaOperatorEnum } from '../../models/criteria-operator.enum';
import { AttributeTypeEnum } from '../../../shared/models/attribute-type.enum';
import { UserLayerStyleModel } from '../../models/user-layer-style.model';
import { StyleHelper } from '../../helpers/style.helper';
import { ScopedUserLayerStyleModel } from '../../models/scoped-user-layer-style.model';
import { AttributeTypeHelper } from '../../../application/helpers/attribute-type.helper';
import { AttributeFilterHelper, RelatedFilterHelper } from '@tailormap/core-components';
import { AttributeMetadataResponseRelation, RelatedFilterDataModel, AttributeFilterModel } from '@tailormap/api';
import { AnalysisSourceModel } from '../../models/analysis-source.model';
import { AttributeMetadataResponse } from '@tailormap/api';
import { ExtendedFormConfigurationModel } from '../../../application/models/extended-form-configuration.model';

export interface AttributeSource extends Omit<AnalysisSourceModel, 'geometryType' | 'geometryAttribute'> {
  relatedTo?: number[];
}

export class CriteriaHelper {

  public static getAvailableSources(
    selectedDataSource: AnalysisSourceModel,
    layerMetadata: AttributeMetadataResponse,
    formConfigs: Map<string, ExtendedFormConfigurationModel>,
  ) {
    if (!layerMetadata) {
      return [];
    }
    const relationSources = CriteriaHelper.getRelationSources(layerMetadata.relations, formConfigs, [ selectedDataSource.featureType ]);
    return [
      { featureType: selectedDataSource.featureType, label: selectedDataSource.label },
      ...relationSources,
    ];
  }

  private static getRelationSources(
    relations: AttributeMetadataResponseRelation[],
    formConfigs: Map<string, ExtendedFormConfigurationModel>,
    relatedTo: number[] = [],
  ) {
    const relationSources: AttributeSource[] = [];
    relations.forEach(relation => {
      const formConfigName = formConfigs.get(relation.foreignFeatureTypeName)?.name;
      const parentCount = relatedTo.length;
      const parentIndent = parentCount > 0
        ? new Array(parentCount * 4).fill('-').join('') + ' '
        : '';
      const label = `${parentIndent}${formConfigName ?? relation.foreignFeatureTypeName}`;

      relationSources.push({
        featureType: relation.foreignFeatureType,
        label,
        relatedTo,
      });

      if ((relation.relations || []).length > 1) {
        relationSources.push(...CriteriaHelper.getRelationSources(
          relation.relations || [],
          formConfigs,
          [ ...relatedTo, relation.foreignFeatureType ],
        ));
      }
    });
    return relationSources;
  }

  public static validGroups(criteriaGroups: CriteriaGroupModel[]) {
    return criteriaGroups.every(group => group.criteria.length >= 1 && group.criteria.every(CriteriaHelper.isValidCriteriaCondition));
  }

  public static isValidCriteriaCondition(criteria: CriteriaConditionModel) {
    return typeof criteria.attributeType !== 'undefined'
      && typeof criteria.attribute !== 'undefined' && criteria.attribute !== ''
      && typeof criteria.condition !== 'undefined' && criteria.condition !== ''
      && typeof criteria.source !== 'undefined' && Number.isInteger(criteria.source)
      && (criteria.attributeType === AttributeTypeEnum.BOOLEAN
      || criteria.condition === AttributeTypeEnum.NULL)
      || (typeof criteria.value !== 'undefined' && criteria.value.join('') !== '');
  }

  public static createCriteria(type: CriteriaTypeEnum, groups: CriteriaGroupModel[]): CriteriaModel {
    return {
      type,
      operator: CriteriaOperatorEnum.AND,
      groups,
    };
  }

  public static createCriteriaGroup(idService: IdService, criteriaConditions: CriteriaConditionModel[]): CriteriaGroupModel {
    return {
      id: idService.getUniqueId('criteria-group'),
      operator: CriteriaOperatorEnum.AND,
      criteria: criteriaConditions,
    };
  }

  public static createCriteriaCondition(idService: IdService): CriteriaConditionModel {
    return { id: idService.getUniqueId('criteria') };
  }

  public static convertStyleToQuery(styles: UserLayerStyleModel[]) {
    const attributes = new Map<string, string[]>();
    const isActiveScopedStyle = (style: UserLayerStyleModel): style is ScopedUserLayerStyleModel => {
      return StyleHelper.isScopedStyle(style) && style.active;
    };
    styles.filter(isActiveScopedStyle).forEach(style => {
      const cur = attributes.get(style.attribute) || [];
      attributes.set(style.attribute, cur.concat([ AttributeTypeHelper.getExpression(style.value, style.attributeType) ]));
    });
    const query: string[] = [];
    attributes.forEach((values, attribute) => {
      query.push(`${attribute} IN (${values.join(',')})`);
    });
    return query.join(' AND ');
  }

  public static convertCriteriaToQuery(criteria: CriteriaModel) {
    if (!criteria || !criteria.groups) {
      return '';
    }
    const query = criteria.groups
      .map(CriteriaHelper.convertGroupToQuery)
      .join(` ${criteria.operator} `);
    return `(${query})`;
  }

  private static convertGroupToQuery(criteriaGroup: CriteriaGroupModel) {
    const groupCriteria = criteriaGroup.criteria
      .map(CriteriaHelper.convertConditionToQuery)
      .join(` ${criteriaGroup.operator} `);
    return `(${groupCriteria})`;
  }

  public static convertConditionToQuery(condition: CriteriaConditionModel) {
    const attributeFilterCondition: AttributeFilterModel = {
      dataId: `${condition.source}_${condition.attribute}_${condition.condition}`,
      featureType: condition.source,
      attribute: condition.attribute,
      condition: condition.condition,
      value: condition.value,
      attributeType: condition.attributeType,
    };
    const filter = AttributeFilterHelper.convertFilterToQuery(attributeFilterCondition);
    if (condition.relatedTo && condition.relatedTo.length > 0) {
      return CriteriaHelper.getRelatedFilter(filter, condition);
    }
    return filter;
  }

  private static getRelatedFilter(filter: string, condition: CriteriaConditionModel) {
    const relatedFilters: RelatedFilterDataModel[] = [];
    let prevParent;
    let prevParentId;
    let idCount = 0;
    // condition.relatedTo contains an array with parents, starting at the top-most parent
    condition.relatedTo.forEach(parent => {
      const id = `condition-${idCount++}`;
      relatedFilters.push({
        dataId: id,
        parentId: prevParentId,
        featureType: parent,
        parentFeatureType: prevParent,
      });
      prevParent = parent;
      prevParentId = id;
    });
    relatedFilters.push({
      dataId: `condition-${idCount++}`,
      featureType: condition.source,
      parentFeatureType: prevParent,
      parentId: prevParentId,
      filter,
    });
    return RelatedFilterHelper.getFilter(relatedFilters[0].dataId, relatedFilters);
  }

}
