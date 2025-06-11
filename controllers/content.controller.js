import { ContentCategory } from '../models/content.model.js';

export const fetchAllCategoriesAndItems = async (req, res) => {
  try {
    const categoriesWithItems = await ContentCategory.aggregate([
      {
        $lookup: {
          from: 'contentitems',
          localField: '_id',
          foreignField: 'category',
          as: 'items'
        }
      },
      {
        $project: {
          name: 1,
          label: 1,
          items: {
            $map: {
              input: '$items',
              as: 'item',
              in: {
                _id: '$$item._id',
                value: '$$item.value',
                createdAt: '$$item.createdAt'
              }
            }
          },
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: 1 }
      }
    ]);

    const groupedData = {};
    categoriesWithItems.forEach(category => {
      groupedData[category.name] = category.items;
    });

    res.status(200).json({
      success: true,
      data: groupedData,
      categories: categoriesWithItems
    });

  } catch (error) {
    console.error('Error fetching categories and items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories and items',
      error: error.message
    });
  }
};