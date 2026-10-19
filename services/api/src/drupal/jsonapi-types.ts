export interface JsonApiResourceIdentifier {
  type: string;
  id: string;
}

export interface JsonApiResource<Attributes = Record<string, unknown>> extends JsonApiResourceIdentifier {
  attributes: Attributes;
  relationships?: Record<string, { data: JsonApiResourceIdentifier | JsonApiResourceIdentifier[] | null }>;
}
