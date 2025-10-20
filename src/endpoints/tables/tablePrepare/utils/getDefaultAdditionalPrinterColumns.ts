import { TAdditionalPrinterColumns } from 'src/localTypes/tableExtensions'

export const getDefaultAdditionalPrinterColumns = ({
  forceDefaultAdditionalPrinterColumns,
  namespaceScopedWithoutNamespace,
}: {
  forceDefaultAdditionalPrinterColumns?: TAdditionalPrinterColumns
  namespaceScopedWithoutNamespace?: boolean
}): TAdditionalPrinterColumns => {
  return (
    forceDefaultAdditionalPrinterColumns || [
      {
        name: 'Name',
        type: 'string',
        jsonPath: '.metadata.name',
      },
      ...(namespaceScopedWithoutNamespace
        ? [
            {
              name: 'Namespace',
              type: 'string',
              jsonPath: '.metadata.namespace',
            },
          ]
        : []),
      {
        name: 'Created',
        type: 'factory',
        jsonPath: '.metadata.creationTimestamp',
        customProps: {
          disableEventBubbling: true,
          items: [
            {
              type: 'parsedText',
              data: {
                id: 'created-timestamp',
                text: "{reqsJsonPath[0]['.metadata.creationTimestamp']['-']}",
                formatter: 'timestamp',
              },
            },
          ],
        },
      },
    ]
  )
}
